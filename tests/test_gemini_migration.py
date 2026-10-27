"""Gemini migration regressions. All network responses are local mocks."""
from pathlib import Path
from types import SimpleNamespace
import json
import sys

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'project09'))
from src import gemini_client as gemini
from src import llm_extraction as extraction
from src import llm_explanation as explanation


@pytest.fixture
def clean(monkeypatch, tmp_path):
    for name in ('GEMINI_API_KEY','GOOGLE_API_KEY','OPENAI_API_KEY','GEMINI_MODEL','GEMINI_TIMEOUT_SECONDS'):
        monkeypatch.delenv(name, raising=False)
    project = tmp_path/'project09'
    project.mkdir()
    monkeypatch.setattr(gemini,'ROOT',project)
    monkeypatch.setattr(extraction,'ROOT',project)
    monkeypatch.setattr(explanation,'ROOT',project)
    return project


def test_website_env_is_loaded_when_project_env_missing(clean):
    (clean.parent/'.env').write_text('GEMINI_API_KEY=test-google-key\n',encoding='utf8')
    assert extraction.get_gemini_status()['configured']
    assert extraction._settings()['source']=='website .env'
    assert explanation._settings()['api_key']=='test-google-key'


def test_explicit_project_key_overrides_stale_environment(clean,monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY','stale')
    monkeypatch.setenv('GOOGLE_API_KEY','also-stale')
    (clean/'.env').write_text('GEMINI_API_KEY=current-file\n',encoding='utf8')
    assert extraction._settings()['api_key']=='current-file'


def test_project_env_overrides_website_env(clean):
    (clean/'.env').write_text('GEMINI_API_KEY=project-file\n',encoding='utf8')
    (clean.parent/'.env').write_text('GEMINI_API_KEY=website-file\n',encoding='utf8')
    assert extraction._settings()['api_key']=='project-file'


def test_legacy_google_key_in_old_env_is_supported(clean):
    (clean/'.env').write_text('OPENAI_API_KEY=AIza-old-google-key\nOPENAI_MODEL=gpt-4.1-mini\n',encoding='utf8')
    settings=extraction._settings()
    assert settings['api_key']=='AIza-old-google-key'
    assert settings['model']==gemini.DEFAULT_MODEL


def test_wrong_provider_disables_ui_without_any_request(clean):
    (clean/'.env').write_text('GEMINI_API_KEY=sk-wrong-provider\n',encoding='utf8')
    status=extraction.get_gemini_status()
    assert not status['configured']
    assert status['error_code']=='wrong_provider_key'


def test_status_never_contains_full_key(clean):
    secret='private-google-key-that-must-not-be-exposed'
    (clean/'.env').write_text('GEMINI_API_KEY='+secret,encoding='utf8')
    assert secret not in json.dumps(extraction.get_gemini_status())


def test_credential_and_model_not_implicitly_selected_from_vertex_environment(clean,monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY','test-key')
    monkeypatch.setenv('GOOGLE_GENAI_USE_VERTEXAI','true')
    monkeypatch.setenv('GEMINI_BASE_URL','https://untrusted.invalid')
    capture={}
    def fake(**kwargs): capture.update(kwargs);return object()
    monkeypatch.setattr(gemini.genai,'Client',fake)
    gemini._client(gemini.settings())
    assert capture['vertexai'] is False
    assert capture['enterprise'] is False
    assert capture['http_options'].base_url==gemini.ENDPOINT
    assert capture['http_options'].retry_options.attempts==1
    assert capture['http_options'].timeout==45000


def test_explanation_uses_actual_sdk_and_structured_google_response(clean,monkeypatch):
    from google import genai
    from google.genai import types
    (clean/'.env').write_text('GEMINI_API_KEY=test-google-key',encoding='utf8')
    captured=[]
    good={'analysis':'Các phương án dựa trên điều kiện thu nhập và chi tiêu khác nhau.',
          'trade_off':'Dành thêm tiền cho kế hoạch làm giảm sự linh hoạt của ngân sách sinh hoạt.'}
    def respond(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200,json={'candidates':[{'content':{'role':'model','parts':[{'text':json.dumps(good)}]},'finishReason':'STOP'}]})
    def client(settings):
        return genai.Client(api_key=settings['api_key'],vertexai=False,enterprise=False,
            http_options=types.HttpOptions(base_url=gemini.ENDPOINT,api_version='v1beta',
                retry_options=types.HttpRetryOptions(attempts=1),
                async_client_args={"trust_env":False}, httpx_client=httpx.Client(transport=httpx.MockTransport(respond),trust_env=False)))
    monkeypatch.setattr(gemini,'_client',client)
    raw=explanation._request_commentary({'what_if':None,'stress_test':None,'goal_name':'Học'},explanation._settings())
    assert raw==good
    assert explanation._safe_commentary(raw)
    assert captured[0]['generationConfig']['responseMimeType']=='application/json'


@pytest.mark.parametrize('reason,expected',[('MAX_TOKENS','incomplete_output'),('SAFETY','model_refusal')])
def test_truncated_or_blocked_response_never_becomes_profile(reason,expected):
    response=SimpleNamespace(candidates=[SimpleNamespace(finish_reason=reason)],text='{}',prompt_feedback=None)
    with pytest.raises(gemini.GeminiError) as error:
        gemini._response_text(response)
    assert error.value.code==expected


def test_google_invalid_key_400_is_auth_error_not_generic_bad_request():
    class Failed(Exception):
        code=400
        response_json={'error':{'details':[{'reason':'API_KEY_INVALID'}]}}
    error=gemini.provider_error(Failed('private provider payload'))
    assert error.code=='api_auth_failed'
    assert 'private' not in str(error)


def test_missing_sdk_keeps_offline_import_usable(clean,monkeypatch):
    monkeypatch.setattr(gemini,'genai',None)
    (clean/'.env').write_text('GEMINI_API_KEY=test-google-key',encoding='utf8')
    with pytest.raises(gemini.GeminiError) as error:
        gemini._client(gemini.settings())
    assert 'google-genai' in str(error.value)
