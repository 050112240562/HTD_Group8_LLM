# HTD Project 09 — bản online có chatbot

Dùng bản này thay bản code cũ. Bản đóng gói không chứa .env thật, môi trường .venv hoặc mã Gmail/Gemini. File gốc đã gửi vẫn giữ nguyên. Không tải file .env cũ lên GitHub.

## Chạy trên Mac

Trong thư mục có server.py:

    python3 -m venv .venv
    source .venv/bin/activate
    python3 -m pip install -r requirements.txt
    cp project09/.env.example project09/.env

Nhập GEMINI_API_KEY, GEMINI_MODEL, GMAIL_SENDER, GMAIL_APP_PASSWORD của bạn trong project09/.env. Lấy model đúng với quyền tài khoản hiện có; mã mặc định giữ từ bản gốc, chưa xác minh quyền sử dụng. Dùng mật khẩu ứng dụng Gmail, không dùng mật khẩu đăng nhập.

    python3 server.py

Mở http://127.0.0.1:8000/customer.html. Không mở HTML bằng file:// hoặc Live Server nếu cần phần Python.

## Triển khai Render

1. Giải nén và đưa NỘI DUNG thư mục HTD_LLM_Gemini lên repo GitHub. server.py và requirements.txt phải cùng cấp ở thư mục gốc repo. Không tải nguyên ZIP làm website.
2. Trong Render, tạo New → Web Service, kết nối repo, chọn Python.
3. Nếu server.py ở gốc repo, để Root Directory trống. Nếu repo có thư mục HTD_LLM_Gemini bao ngoài, nhập tên thư mục đó.
4. Build Command: `pip install -r requirements.txt`.
5. Start Command: `python server.py --host 0.0.0.0`.
6. Health Check Path: `/healthz`.
7. Nhập biến môi trường: GEMINI_API_KEY, GEMINI_MODEL (model tài khoản được phép dùng), GEMINI_TIMEOUT_SECONDS=45; nếu dùng mail thì thêm GMAIL_SENDER và GMAIL_APP_PASSWORD. Không nhập mã vào HTML/JS hoặc commit .env.
8. Khi chạy gói Free: đặt EMAIL_TRANSPORT_DISABLED=true. Web, tính toán, PDF và chatbot vẫn sử dụng được nếu Gemini có quyền/hạn mức; gửi Gmail sẽ báo rõ môi trường chưa bật SMTP. Muốn giữ cách gửi bằng mật khẩu ứng dụng: chọn môi trường/gói máy chủ cho phép SMTP cổng 465, đặt EMAIL_TRANSPORT_DISABLED=false và kiểm thử thực tế. Không tự động mua gói.
9. Deploy, đợi thành công, mở link Render rồi thêm `/customer.html`. Đường dẫn gốc `/` vẫn mở trang HTD hiện có.

render.yaml cũng được cung cấp để dùng Blueprint nếu bạn quen cách này; cấu hình mặc định Free và tắt gửi SMTP. Chuyển gói không tự thay giá trị EMAIL_TRANSPORT_DISABLED: cần sửa lại khi bật email.

Dùng một link Render cho cả giao diện và API. Bản này không chuyển GitHub Pages thành server Python và không cấu hình CORS để ghép hai host. GitHub dùng lưu code; link demo đầy đủ là link Render.

## Chatbot và prompt

Prompt đầy đủ: project09/config/chatbot_system_vi.txt. Có thể chỉnh văn phong/phạm vi tại đó rồi khởi động lại dịch vụ. Logic: project09/src/chatbot.py; API: /api/chat; giao diện dùng js/project09-service.js và css/chatbot.css.

Sau khi tạo kế hoạch, khung chat xuất hiện dưới nội dung chính. Người dùng đồng ý gửi kế hoạch và hội thoại đến Gemini rồi gửi câu hỏi. Không có key thì không bật nút gửi; lỗi Gemini hiện trực tiếp, không giả làm trả lời AI. Kế hoạch đã tính vẫn dùng được.

Chatbot chỉ giải thích lập kế hoạch cá nhân và chức năng HTD. Câu ngoài lĩnh vực bị từ chối bằng lời cố định. Yêu cầu trộn nhiều chủ đề chỉ trả lời phần phù hợp. Prompt quy định không làm theo yêu cầu đổi vai/bỏ giới hạn, không tiết lộ cấu hình và không chọn cổ phiếu/mua bán cụ thể.

Khi thay giả định, bot dùng stress/what-if đã có nếu khớp; nếu chưa có kết quả, chỉ giải thích định tính và hướng dẫn dùng Thử thay đổi → Cập nhật kết quả. Không tự chạy phép tính mới trong chat. Bộ máy Python vẫn là nguồn tính toán.

Chatbot dùng kế hoạch trên máy chủ, bỏ user_id trước khi gửi; không gửi .env. Hội thoại lưu tạm trên máy chủ, tối đa 4 cặp hỏi/đáp trong ngữ cảnh, tối đa 30 lượt/phiên, giãn tối thiểu 3 giây. Kết quả và hội thoại hết hạn theo phiên kế hoạch (1 giờ), mất khi restart; không phải hệ thống tài khoản lưu lịch sử. Chỉnh/tạo lại kế hoạch xóa hội thoại đang hiển thị. Không có cơ chế đăng nhập cho dịch vụ công cộng: bản này dành demo có kiểm soát, chưa có kiểm soát lạm dụng toàn hệ thống.

## Kiểm tra sau triển khai

- Mẫu hồ sơ → xác nhận thông tin → xem kế hoạch → ba kịch bản/Thử thay đổi.
- Phân tích tiêu chuẩn → tải PDF.
- Nhận xét Gemini với sự đồng ý; kiểm tra model, quota và quyền nếu lỗi.
- Chat: giải thích kết quả; hỏi 'Nếu thu nhập giảm 10% trong 3 tháng'; thử câu ngoài lĩnh vực và yêu cầu bỏ giới hạn. Kiểm tra số liệu AI đối chiếu bảng tính, không coi prompt là bảo đảm tuyệt đối.
- Gmail: chỉ thử khi đã cấu hình môi trường SMTP; xác nhận địa chỉ nhận rồi gửi. Kiểm tra cả thư rác.

Bộ kiểm thử tự động sử dụng phản hồi Gemini giả lập và không gửi email thật. Chưa xác minh tài khoản Gemini/Gmail hoặc deploy lên tài khoản Render của bạn. Phiên bản ban đầu dùng SimpleHTTPRequestHandler, đã chặn đọc mã nguồn, file cấu hình và liệt kê thư mục; không thay thế backend production có xác thực.

Nguồn yêu cầu triển khai và giới hạn SMTP (đối chiếu 27/10/2026):
- https://render.com/docs/web-services
- https://render.com/docs/free

Các hướng dẫn cũ trong gói được giữ để tham khảo; file BAT_DAU_ONLINE_CHATBOT.md này là hướng dẫn ưu tiên cho thay đổi lần này. File js/sendPdfEmail.js thuộc luồng FI cũ; customer.html của Project09 không nạp nó, và gửi báo cáo bằng /api/email.
