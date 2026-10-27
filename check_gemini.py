"""Show safe configuration; --live explicitly sends one synthetic Gemini test."""
from pathlib import Path
import argparse
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "project09"))
try:
    from src import gemini_client as gemini
except ImportError:
    print("Thiếu thư viện. Chạy: python3 -m pip install -r requirements-gemini.txt")
    raise SystemExit(1)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--live", action="store_true", help="Gửi một yêu cầu thử không có dữ liệu tài chính; có thể dùng quota/phát sinh phí theo project.")
args = parser.parse_args()
status = gemini.status()
print("Nhà cung cấp:", status["provider"])
print("Model:", status["model"])
print("Nguồn cấu hình:", status["source"] or "Chưa có")
print("Đã nhận cấu hình:", status["configured"])
if not status["configured"]:
    print(status["message"])
    raise SystemExit(1)
if not args.live:
    print("Chưa gọi API. Để thử một yêu cầu thật: python3 check_gemini.py --live")
    raise SystemExit(0)
try:
    result = gemini.generate_json(
        'Đây là kiểm tra kết nối. Trả JSON với ok=true, không viết nội dung khác.',
        'Kiểm tra kết nối, không chứa thông tin cá nhân.',
        {"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"],"additionalProperties":False},
        gemini.settings(), max_output_tokens=1024)
    if result.get("ok") is not True:
        raise gemini.GeminiError("invalid_output", "Đã nhận phản hồi nhưng chưa đúng nội dung kiểm tra.")
    print("THÀNH CÔNG: Gemini đã trả phản hồi JSON cho yêu cầu thật.")
except gemini.GeminiError as exc:
    print("CHƯA THÀNH CÔNG:", exc.code, "—", str(exc))
    raise SystemExit(1)
