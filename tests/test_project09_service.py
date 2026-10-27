from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
from io import BytesIO
import json, threading, urllib.request, urllib.error
import pytest
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
spec=spec_from_file_location('p9server', ROOT/'server.py');srv=module_from_spec(spec);spec.loader.exec_module(srv)
@pytest.fixture(scope='module')
def api():
    http=srv.ThreadingHTTPServer(('127.0.0.1',0),srv.Handler)
    threading.Thread(target=http.serve_forever,daemon=True).start()
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def call(route,body=None):
        req=urllib.request.Request(f'http://127.0.0.1:{http.server_port}/api/{route}',data=None if body is None else json.dumps(body).encode(),headers={} if body is None else {'Content-Type':'application/json'})
        try:
            response=opener.open(req);raw=response.read()
            return response.status,raw if response.headers.get_content_type()=='application/pdf' else json.loads(raw)
        except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
    yield call
    http.shutdown();http.server_close()
def sample(api,case='P001'):
    c=srv.SAMPLES[case];status,out=api('sample',{'id':case,'text':c['input_text']});assert status==200;return out['profile']
def plan(api,case='P001',**extra):
    body={'profile':sample(api,case),'profile_confirmed':True,'assumptions':{'annual_return_rate':0},'income_reduction_rate':0,'duration_months':3,**extra}
    status,out=api('plan',body);assert status==200;return out

def test_config_exposes_no_credentials(api,monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY',raising=False)
    status,out=api('config');assert status==200
    assert {s['id'] for s in out['samples']}=={'P001','P006','P009','P019'}
    assert 'api_key' not in out

def test_sample_edits_rejected_and_missing_information_blocks_plan(api):
    status,_=api('sample',{'id':'P001','text':'Changed sample'});assert status==400
    p=sample(api,'P009');assert p['goal_horizon_months'] is None
    out=plan(api,'P009');assert out['blocked'];assert not out['validation']['can_simulate']

def test_plan_needs_confirmation(api):
    status,_=api('plan',{'profile':sample(api),'profile_confirmed':False});assert status==400

def test_zero_shock_matches_every_scenario_exactly(api):
    out=plan(api)
    for k in ('conservative','base','optimistic'):
        before=out['scenarios'][k]['calculation_result'];stress=out['stress_by_scenario'][k]
        assert stress['comparison']['fv_total_reduction']==0
        assert stress['stressed']['calculation_result']['fv_total']==before['fv_total']
        assert stress['stressed']['calculation_result']['estimated_month_to_goal']==before['estimated_month_to_goal']

def test_shock_and_what_if_use_original_engine(api):
    out=plan(api,'P019',income_reduction_rate=.2,what_if={'monthly_primary_income':19000000})
    assert out['scenarios']['base']['calculation_result']['fv_total']==130000000
    assert out['stress_by_scenario']['base']['stressed']['calculation_result']['fv_total']==118000000
    assert out['what_if']['modified']['calculation_result']['monthly_contribution']==6000000
    assert out['scenarios']['base']['profile_used']['monthly_primary_income']==18000000

def test_live_llm_requires_consent(api,monkeypatch):
    monkeypatch.setattr(srv,'extract_profile_with_evidence',lambda _:pytest.fail('must not call LLM'))
    status,_=api('extract',{'text':'test','consent':False});assert status==400

def test_pdf_uses_stored_engine_results_and_explicit_confirmations(api,monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY',raising=False)
    out=plan(api);req={'plan_id':out['plan_id']}
    status,_=api('explain',req);assert status==400
    req['assumptions_confirmed']=True
    status,text=api('explain',req);assert status==200;assert text['mode']=='offline'
    status,_=api('report',req);assert status==400
    status,pdf=api('report',{**req,'report_confirmed':True});assert status==200;assert pdf.startswith(b'%PDF')
    reader=PdfReader(BytesIO(pdf));assert len(reader.pages)>=3
    assert '118.000.000' in ' '.join(p.extract_text() for p in reader.pages)

def test_unknown_plan_token_rejected(api):
    status,_=api('explain',{'plan_id':'missing','assumptions_confirmed':True});assert status==400
