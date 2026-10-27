"""Serve the unchanged HTD website and the Project 09 service on one local URL."""
from __future__ import annotations
import argparse
from copy import deepcopy
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from urllib.parse import unquote
from uuid import uuid4

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT / 'project09'
sys.path.insert(0, str(PROJECT))
from src.plan_guidance import build_plan_guidance
from src.schemas import parse_financial_profile
from src.validation import validate_profile
from src.scenarios import build_scenarios, run_what_if, ScenarioInputError, load_scenario_defaults
from src.stress_test import run_stress_test
from src.market_reference import reference_assumptions
from src.llm_extraction import extract_mock_profile, extract_profile_with_evidence, get_gemini_status, ExtractionError
from src.llm_explanation import generate_explanation_result, ExplanationError
from src.report_generator import generate_report, ReportError

CASES = json.loads((PROJECT / 'data/test_cases.json').read_text(encoding='utf-8'))['cases']
SAMPLES = {c['case_id']: c for c in CASES if c['case_id'] in {'P001', 'P006', 'P019', 'P009'}}
PLANS: dict[str, dict] = {}


def create_plan(payload: dict) -> dict:
    if payload.get('profile_confirmed') is not True:
        raise ValueError('Bạn cần kiểm tra và xác nhận hồ sơ trước khi xem kế hoạch.')
    p = parse_financial_profile(payload['profile']).to_profile_dict()
    a = payload.get('assumptions', reference_assumptions())
    validation = validate_profile(p, a)
    if not validation['can_simulate']:
        return {'blocked': True, 'validation': validation}
    scenarios = build_scenarios(p, a)
    base = scenarios['base']
    a = base['assumptions']
    validation = validate_profile(p, a)
    reduction = payload.get('income_reduction_rate', 0)
    duration = payload.get('duration_months', 3)
    if isinstance(reduction, bool) or reduction not in (0, .1, .2, .3) or duration not in (3, 6) or isinstance(duration, bool):
        raise ValueError('Chọn mức giảm 0%, 10%, 20%, 30% trong 3 hoặc 6 tháng.')
    stress_config = {'income_reduction_rate': reduction, 'duration_months': duration, 'start_month': 1}
    stresses = {name: run_stress_test(scenarios[name]['profile_used'], scenarios[name]['assumptions'], stress_config)
                for name in ('conservative', 'base', 'optimistic')}
    wi = payload.get('what_if')
    what_if = run_what_if(p, a, wi) if wi is not None else None
    result = {'scenarios': scenarios, 'stress_test': stresses['base'], 'what_if': what_if, 'is_final_plan': False}
    for key, stored in list(PLANS.items()):
        if stored['expires'] < time.time(): PLANS.pop(key, None)
    if len(PLANS) >= 64: PLANS.pop(next(iter(PLANS)), None)
    token = uuid4().hex
    PLANS[token] = {'profile': p, 'assumptions': a, 'calculation_result': base['calculation_result'],
                    'scenario_result': result, 'validation_result': validation, 'expires': time.time() + 3600}
    return {'plan_id': token, 'scenarios': scenarios, 'stress_by_scenario': stresses,
            'what_if': what_if, 'validation': validation, 'assumptions': a, 'stress_config': stress_config,
            'guidance': build_plan_guidance(p, base['calculation_result'], base)}


def get_plan(payload: dict) -> dict:
    plan = PLANS.get(payload.get('plan_id'))
    if not plan or plan['expires'] < time.time():
        raise ValueError('Phiên kết quả đã hết hạn. Bấm Cập nhật kết quả và xác nhận lại.')
    if payload.get('assumptions_confirmed') is not True:
        raise ValueError('Bạn cần xác nhận giả định và phép thử của báo cáo.')
    return plan


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def json_response(self, value, code=200):
        content = json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(content)))
        self.end_headers(); self.wfile.write(content)
    def do_GET(self):
        if self.path == '/api/config':
            self.json_response({'samples': [{'id': k, 'goal': c['expected_profile']['goal_name'], 'text': c['input_text']} for k,c in SAMPLES.items()],
                                'defaults': reference_assumptions(), 'scenario_defaults': load_scenario_defaults()['scenarios'], 'limits': load_scenario_defaults()['limits'], 'ai_configured': bool(get_gemini_status()['configured']),
                                'ai_provider': 'Gemini', 'ai_model': get_gemini_status()['model'],
                                'ai_message': get_gemini_status()['message']})
        elif self.path.startswith('/api/'):
            self.json_response({'error': 'Không tìm thấy chức năng này.'}, 404)
        elif any(part.startswith('.') for part in unquote(self.path).split('/')):
            self.send_error(404)
        elif self.path.split('?')[0].rstrip('/') == '/server.py':
            self.send_error(404)
        else: super().do_GET()
    def do_POST(self):
        try:
            origin = self.headers.get('Origin')
            if origin and origin != 'http://' + self.headers.get('Host', ''):
                self.json_response({'error': 'Hãy mở web bằng địa chỉ dịch vụ cục bộ.'}, 403); return
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                self.json_response({'error': 'Cần dữ liệu JSON.'}, 415); return
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 100_000:
                self.json_response({'error': 'Dữ liệu gửi lên quá lớn hoặc rỗng.'}, 400); return
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict): raise ValueError('Dữ liệu cần có cấu trúc hồ sơ.')
            if self.path == '/api/sample':
                c = SAMPLES.get(payload.get('id'))
                if not c or payload.get('text') != c['input_text']:
                    raise ValueError('Demo chỉ dùng nguyên văn tình huống mẫu. Chọn lại mẫu, rồi sửa các ô ở bước Kiểm tra.')
                profile = extract_mock_profile(payload['text'])
                self.json_response({'profile': profile, 'source': 'sample', 'text': c['input_text']})
            elif self.path == '/api/extract':
                if payload.get('consent') is not True: raise ValueError('Bạn cần đồng ý gửi mô tả trước khi dùng AI.')
                out = extract_profile_with_evidence(payload.get('text', ''))
                self.json_response({**out, 'source': 'live_llm'})
            elif self.path == '/api/validate':
                p = parse_financial_profile(payload['profile']).to_profile_dict()
                self.json_response(validate_profile(p, payload.get('assumptions', reference_assumptions())))
            elif self.path == '/api/plan': self.json_response(create_plan(payload))
            elif self.path == '/api/explain':
                plan = get_plan(payload)
                use_llm = payload.get('use_llm') is True
                if use_llm and payload.get('consent') is not True: raise ValueError('Cần đồng ý gửi mục tiêu và kết quả để thêm nhận xét AI.')
                out = generate_explanation_result(plan['profile'], plan['calculation_result'], plan['scenario_result'], plan['validation_result'], use_llm=use_llm)
                plan['explanation'] = out
                self.json_response(out)
            elif self.path == '/api/report':
                plan = get_plan(payload)
                if payload.get('report_confirmed') is not True: raise ValueError('Bạn cần đọc và xác nhận nội dung trước khi tải PDF.')
                explanation = plan.get('explanation')
                if not explanation: raise ValueError('Hãy tạo phần giải thích trước khi tải PDF.')
                with tempfile.TemporaryDirectory() as folder:
                    path = str(Path(folder) / 'Project09.pdf')
                    generate_report(plan['profile'], {**plan, 'profile_confirmed': True, 'assumptions_confirmed': True, 'report_confirmed': True}, explanation['text'], path)
                    content = Path(path).read_bytes()
                self.send_response(200); self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', 'attachment; filename="HTD_Project09_Plan.pdf"')
                self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(content)))
                self.end_headers(); self.wfile.write(content)
            else: self.json_response({'error': 'Không tìm thấy chức năng này.'}, 404)
        except (ValueError, TypeError, KeyError, ScenarioInputError, ExtractionError, ExplanationError, ReportError) as exc:
            self.json_response({'error': str(exc)}, 400)
        except Exception:
            self.json_response({'error': 'Chưa xử lý được yêu cầu. Hãy kiểm tra thiết lập hoặc thử lại.'}, 500)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    print(f'Mở http://127.0.0.1:{args.port}/index.html ; Services: /customer.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
