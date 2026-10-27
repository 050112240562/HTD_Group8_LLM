"""Gemini adapter based on genai.ipynb; no network calls at import time.

Financial calculations and profile validation remain independent of the model.
Only explicit user actions send data to Google's fixed Developer API endpoint.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import httpx
from dotenv import dotenv_values

try:
    from google import genai
    from google.genai import types
    from google.genai.errors import APIError
except ImportError:
    genai = types = None
    APIError = ()

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = "gemini-3.5-flash-lite"
ENDPOINT = "https://generativelanguage.googleapis.com"


class GeminiError(RuntimeError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def _key(config: dict) -> str:
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        value = (config.get(name) or "").strip()
        if value:
            return value
    # Compatibility for the Google key the user placed in the previous .env.
    old = (config.get("OPENAI_API_KEY") or "").strip()
    return old if old.startswith("AIza") else ""


def configuration(project_root: Path | None = None) -> tuple[dict, str]:
    root = ROOT if project_root is None else project_root
    for path, source in ((root / ".env", "project .env"),
                         (root.parent / ".env", "website .env")):
        data = dict(dotenv_values(path, encoding="utf-8-sig", interpolate=False))
        if _key(data):
            # Explicit file credentials win over stale exported credentials.
            merged = {**os.environ, **data}
            merged["GEMINI_API_KEY"] = _key(data)
            return merged, source
    return dict(os.environ), "Terminal environment"


def settings(project_root: Path | None = None) -> dict:
    config, source = configuration(project_root)
    key = _key(config)
    if not key:
        if (config.get("OPENAI_API_KEY") or "").strip():
            raise GeminiError("wrong_provider_key", "Bản này dùng Gemini. Đặt key Google AI Studio vào GEMINI_API_KEY trong .env; không dùng key OpenAI.")
        raise GeminiError("api_key_missing", "Chưa có GEMINI_API_KEY. Điền key Google AI Studio trong project09/.env hoặc .env cạnh server.py; mẫu và nhập tay vẫn dùng được.")
    if key.startswith("sk-"):
        raise GeminiError("wrong_provider_key", "GEMINI_API_KEY đang chứa key OpenAI. Hãy dùng key từ Google AI Studio.")
    model = (config.get("GEMINI_MODEL") or DEFAULT_MODEL).strip()
    if not model.startswith("gemini-") or any(c in model for c in ("/", "?", "#", " ", "\n")):
        raise GeminiError("invalid_config", "GEMINI_MODEL phải là mã model Gemini, ví dụ gemini-3.5-flash-lite.")
    try:
        timeout = float(config.get("GEMINI_TIMEOUT_SECONDS", "45"))
        if not math.isfinite(timeout) or not 1 <= timeout <= 120:
            raise ValueError
    except (TypeError, ValueError):
        raise GeminiError("invalid_config", "GEMINI_TIMEOUT_SECONDS phải là số từ 1 đến 120.") from None
    return {"api_key": key, "model": model, "timeout": timeout,
            "source": source, "key_suffix": key[-4:]}


def status(project_root: Path | None = None) -> dict:
    try:
        s = settings(project_root)
    except GeminiError as exc:
        return {"configured": False, "verified": False, "provider": "Gemini",
                "model": DEFAULT_MODEL, "source": None, "key_suffix": None,
                "error_code": exc.code, "message": str(exc)}
    return {"configured": True, "verified": False, "provider": "Gemini",
            "model": s["model"], "source": s["source"], "key_suffix": s["key_suffix"],
            "endpoint": ENDPOINT, "error_code": None, "message": "Đã nhận cấu hình Gemini; chưa kiểm tra kết nối hoặc hạn mức."}


def provider_error(exc: Exception) -> GeminiError:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if not isinstance(code, int):
        code = None
    # Google often returns invalid-key errors as HTTP 400, not HTTP 401.
    details = getattr(exc, "details", None)
    payload = getattr(exc, "response_json", None)
    reasons = json.dumps([details, payload], default=lambda _: "").upper()
    if code == 401 or "API_KEY_INVALID" in reasons:
        return GeminiError("api_auth_failed", "Gemini không chấp nhận API key. Kiểm tra key Google AI Studio và lưu lại .env; không cần đổi key nếu lỗi chỉ là quota.")
    if code == 403:
        return GeminiError("api_permission_denied", "Gemini từ chối quyền truy cập. Kiểm tra giới hạn của key, project, khu vực và quyền dùng model trong Google AI Studio.")
    if code == 404:
        return GeminiError("api_model_not_found", "Không tìm thấy model hoặc project chưa có quyền dùng model này. Kiểm tra GEMINI_MODEL; model 2.5 có thể bị hạn chế với dự án mới.")
    if code == 429:
        return GeminiError("api_quota_exceeded", "Gemini đã chạm quota hoặc giới hạn tốc độ của project/model. Kiểm tra Usage và Rate limits trong Google AI Studio; tạo key mới trong cùng project không tăng quota. Free Tier cũng có giới hạn.")
    if code == 400:
        return GeminiError("api_request_invalid", "Gemini không chấp nhận yêu cầu. Kiểm tra GEMINI_MODEL và cập nhật google-genai; model cần hỗ trợ structured output.")
    if code == 402:
        return GeminiError("api_billing_required", "Project Gemini đang yêu cầu thanh toán. Kiểm tra Billing Tier và số dư trên Google AI Studio, hoặc chọn model/project có Free Tier phù hợp.")
    if code is not None and code >= 500:
        return GeminiError("api_service_unavailable", "Dịch vụ Gemini đang tạm thời gặp sự cố; giữ nguyên dữ liệu và thử lại sau.")
    if isinstance(exc, httpx.TimeoutException) or "timeout" in type(exc).__name__.lower():
        return GeminiError("api_timeout", "Gemini phản hồi quá thời gian chờ. Thử lại sau hoặc điều chỉnh GEMINI_TIMEOUT_SECONDS.")
    if isinstance(exc, (httpx.RequestError, OSError)):
        return GeminiError("api_connection_failed", "Không kết nối được Gemini. Kiểm tra Internet, VPN hoặc proxy.")
    return GeminiError("api_unavailable", "Chưa gọi được Gemini. Kiểm tra cấu hình và thư viện; nội dung phản hồi riêng tư không được hiển thị.")


def _client(s: dict):
    if genai is None:
        raise GeminiError("api_unavailable", "Thiếu google-genai. Chạy python3 -m pip install -r requirements.txt rồi khởi động lại web.")
    return genai.Client(api_key=s["api_key"], vertexai=False, enterprise=False,
                        http_options=types.HttpOptions(
                            base_url=ENDPOINT, api_version="v1beta",
                            timeout=int(s["timeout"] * 1000),
                            retry_options=types.HttpRetryOptions(attempts=1)))


def _response_text(response) -> str:
    feedback = getattr(response, "prompt_feedback", None)
    blocked = getattr(feedback, "block_reason", None)
    if blocked and getattr(blocked, "value", str(blocked)) not in ("BLOCK_REASON_UNSPECIFIED", "0"):
        raise GeminiError("model_refusal", "Gemini từ chối nội dung này. Kiểm tra mô tả hoặc dùng nhập tay.")
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        raise GeminiError("invalid_output", "Gemini chưa trả nội dung. Thử lại hoặc nhập tay.")
    reason = getattr(candidates[0], "finish_reason", None)
    reason = getattr(reason, "value", str(reason))
    if reason in {"SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "RECITATION", "SPII"}:
        raise GeminiError("model_refusal", "Gemini từ chối phản hồi. Kiểm tra mô tả hoặc nhập tay.")
    if reason != "STOP":
        raise GeminiError("incomplete_output", "Gemini chưa hoàn thành phản hồi; không dùng bản nháp bị cắt. Thử lại hoặc rút ngắn mô tả.")
    text = getattr(response, "text", None)
    if not isinstance(text, str) or not text.strip():
        raise GeminiError("invalid_output", "Gemini trả nội dung rỗng. Thử lại hoặc nhập tay.")
    return text


def strict_json(raw: str) -> dict:
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate key")
            result[key] = value
        return result
    try:
        obj = json.loads(raw, object_pairs_hook=unique,
                         parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite")))
        if not isinstance(obj, dict):
            raise ValueError("object required")
        return obj
    except (TypeError, ValueError, RecursionError):
        raise GeminiError("invalid_output", "Gemini trả JSON không hợp lệ. Hãy thử lại hoặc nhập tay.") from None


def generate_json(prompt: str, text: str, schema: dict, s: dict, *, max_output_tokens: int = 8192) -> dict:
    try:
        with _client(s) as client:
            response = client.models.generate_content(
                model=s["model"], contents=text,
                config=types.GenerateContentConfig(
                    system_instruction=prompt, response_mime_type="application/json",
                    response_json_schema=schema, max_output_tokens=max_output_tokens))
        return strict_json(_response_text(response))
    except GeminiError:
        raise
    except Exception as exc:
        raise provider_error(exc) from None


def verify_connection(project_root: Path | None = None) -> dict:
    s = settings(project_root)
    try:
        with _client(s) as client:
            client.models.get(model=s["model"])
    except GeminiError:
        raise
    except Exception as exc:
        raise provider_error(exc) from None
    return {**status(project_root), "verified": True,
            "verification_scope": "model metadata only; generation quota not tested"}
