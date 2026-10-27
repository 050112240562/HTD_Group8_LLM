"""Plan-scoped assistant; no credentials or client-provided results enter context."""
import json
import re
import threading
import time
from pathlib import Path
from .gemini_client import generate_json, settings, GeminiError

PROMPT = (Path(__file__).parents[1] / 'config/chatbot_system_vi.txt').read_text(encoding='utf-8')
REFUSAL = 'Xin lỗi, tôi chỉ hỗ trợ lập kế hoạch tài chính cá nhân và sử dụng hệ thống HTD. Bạn có thể hỏi về tiết kiệm, chi tiêu, quỹ dự phòng hoặc kết quả kế hoạch của mình.'
SCHEMA = {'type': 'object', 'properties': {'in_scope': {'type': 'boolean'}, 'answer': {'type': 'string'}}, 'required': ['in_scope', 'answer'], 'additionalProperties': False}
LOCK = threading.Lock()

def context_for(plan):
    # Deliberately omit identifiers, addresses, credentials and stored explanations.
    profile = {k:v for k,v in plan['profile'].items() if k not in {'user_id', 'email', 'name', 'phone'}}
    return {'profile': profile, 'assumptions': plan['assumptions'],
            'calculation_result': plan['calculation_result'],
            'scenarios_and_tests': plan['scenario_result'],
            'validation': plan['validation_result']}

def reply(plan, message):
    if not isinstance(message, str) or not 1 <= len(message.strip()) <= 1600:
        raise ValueError('Câu hỏi cần có từ 1 đến 1.600 ký tự.')
    with LOCK:
        if plan.get('chat_busy') or time.time() - plan.get('chat_last', 0) < 3:
            raise ValueError('Vui lòng chờ vài giây trước khi gửi câu hỏi tiếp theo.')
        if plan.get('chat_count', 0) >= 30:
            raise ValueError('Đã đủ 30 lượt trong phiên. Hãy tạo lại kế hoạch để mở phiên mới.')
        plan['chat_busy'] = True
        plan['chat_last'] = time.time()
    try:
        history = plan.get('chat_history', [])[-8:]
        data = {'verified_plan': context_for(plan), 'conversation': history, 'question': message.strip()}
        out = generate_json(PROMPT, json.dumps(data, ensure_ascii=False, allow_nan=False), SCHEMA, settings(), max_output_tokens=3000)
        if type(out.get('in_scope')) is not bool or not isinstance(out.get('answer'), str):
            raise ValueError('Chatbot chưa trả lời đúng định dạng. Hãy thử lại.')
        answer = out['answer'].strip()
        if not out['in_scope']:
            answer = REFUSAL
        elif not answer or len(answer) > 6000:
            raise ValueError('Chatbot chưa hoàn thành câu trả lời hợp lệ. Hãy thử lại.')
        # Reject explicit model attempts to emit secrets even if user supplied them.
        if re.search(r'AIza[\w-]{20,}|sk-[\w-]{20,}', answer):
            raise ValueError('Câu trả lời chứa nội dung không phù hợp để hiển thị. Hãy hỏi lại về kế hoạch.')
        plan['chat_history'] = (history + [{'role':'user','text':message.strip()}, {'role':'assistant','text':answer}])[-8:]
        plan['chat_count'] = plan.get('chat_count', 0) + 1
        return {'answer':answer, 'in_scope':out['in_scope'], 'source':'gemini', 'remaining':30-plan['chat_count']}
    finally:
        with LOCK:
            plan['chat_busy'] = False
