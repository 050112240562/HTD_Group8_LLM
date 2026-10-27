import importlib.util
from pathlib import Path
from unittest.mock import patch
import json
import threading
import urllib.request
import urllib.error
import pytest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('online_server', ROOT/'server.py')
srv=importlib.util.module_from_spec(spec);spec.loader.exec_module(srv)
from src import chatbot

def plan():
    return {'profile': {'goal_name':'Học cao học','user_id':'private-id'}, 'assumptions':{}, 'calculation_result':{}, 'scenario_result':{}, 'validation_result':{}}

def test_scope_refusal_replaces_model_output():
    with patch.object(chatbot,'settings',return_value={}), patch.object(chatbot,'generate_json',return_value={'in_scope':False,'answer':'unrelated output'}):
        out=chatbot.reply(plan(),'Viết giúp một bài về bóng đá')
    assert out['answer']==chatbot.REFUSAL
    assert not out['in_scope']

def test_context_has_no_identifier_or_client_history():
    p=plan()
    captured={}
    def generate(prompt,text,*args,**kwargs):
        captured.update(json.loads(text))
        return {'in_scope':True,'answer':'Kế hoạch cần được tính lại khi thay đổi giả định.'}
    with patch.object(chatbot,'settings',return_value={}),patch.object(chatbot,'generate_json',side_effect=generate):
        out=chatbot.reply(p,'Nếu lương giảm thì sao?')
    assert 'private-id' not in json.dumps(captured)
    assert out['remaining']==29
    assert p['chat_history'][-1]['role']=='assistant'
    with pytest.raises(ValueError): chatbot.reply(p,'Hỏi tiếp')

@pytest.fixture
def http():
    server=srv.ThreadingHTTPServer(('127.0.0.1',0),srv.Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}'
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def call(path,body=None,origin=None,method=None):
        headers={}
        if origin:headers['Origin']=origin
        if body is not None:headers['Content-Type']='application/json'
        req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
        try:
            r=opener.open(req);return r.status,r.read()
        except urllib.error.HTTPError as e:return e.code,e.read()
    yield call,base
    server.shutdown();server.server_close()

def test_online_https_origin_and_health(http):
    call,base=http
    assert call('/healthz')[0]==200
    assert call('/api/validate',{},origin=base.replace('http:','https:'))[0]==400
    assert call('/api/validate',{},origin='https://example.org')[0]==403

def test_static_no_source_or_directory_leaks(http):
    call,_=http
    for path in ['/server.py','/project09/.env','/project09/src/chatbot.py','/project09/data/test_cases.json','/project09/config/chatbot_system_vi.txt','/project09/']:
        assert call(path)[0]==404
        assert call(path,method='HEAD')[0]==404
    assert call('/customer.html')[0]==200
    assert call('/js/project09-service.js')[0]==200

def test_chat_requires_plan_and_consent(http):
    call,_=http
    srv.PLANS['chat-test']={**plan(),'expires':10**12}
    assert call('/api/chat',{'plan_id':'chat-test','assumptions_confirmed':True,'message':'Xin chào'})[0]==400
    with patch.object(srv,'chat_reply',return_value={'answer':'Xin chào','in_scope':True,'remaining':29}):
        assert call('/api/chat',{'plan_id':'chat-test','assumptions_confirmed':True,'message':'Xin chào','consent':True})[0]==200
    assert call('/api/chat',{'plan_id':'expired','assumptions_confirmed':True,'message':'Xin chào','consent':True})[0]==400

def test_email_disabled_on_free_environment(monkeypatch):
    from src.email_delivery import send_plan_email
    monkeypatch.setenv('EMAIL_TRANSPORT_DISABLED','true')
    with pytest.raises(ValueError,match='SMTP'):
        send_plan_email('demo@example.com',b'%PDF-mock')

def test_email_attachment_with_mock_transport(monkeypatch):
    from src import email_delivery
    from unittest.mock import MagicMock
    monkeypatch.setenv('EMAIL_TRANSPORT_DISABLED','false')
    monkeypatch.setenv('GMAIL_SENDER','sender@example.com')
    monkeypatch.setenv('GMAIL_APP_PASSWORD','fake-password-for-test')
    smtp=MagicMock()
    with patch.object(email_delivery.smtplib,'SMTP_SSL',return_value=smtp):
        email_delivery.send_plan_email('receiver@example.com',b'%PDF-mock')
    msg=smtp.__enter__.return_value.send_message.call_args.args[0]
    assert msg['To']=='receiver@example.com'
    assert next(msg.iter_attachments()).get_payload(decode=True)==b'%PDF-mock'
