BẢN LLM ĐÃ CHUYỂN SANG GEMINI
Xem HUONG_DAN_GEMINI.txt. Chạy bằng python3 server.py; Live Server không chạy phần Services Python.

Tài liệu lịch sử bản HTD:
BẢN WEBSITE HTD — CẬP NHẬT DEMO HỒ SƠ KHÁCH HÀNG

Cách dùng: Giải nén ZIP. Mở thư mục web_htd trong VS Code và chạy index.html bằng Live Server.

MỚI: Vào Services (customer.html) → Demo hồ sơ khách hàng.
- 3 hồ sơ đầy đủ và 1 tình huống thiếu thông tin.
- Mô phỏng đầu ra trích xuất LLM từ mô tả mẫu, kèm câu gốc để đối chiếu.
- Cho sửa hồ sơ, chỉ lọc sau khi đủ thông tin và được khách hàng xác nhận.
- Lọc/xếp hạng tối đa 5 mã bằng quy tắc ngoại tuyến, có lý do từng mã.
- Không tự nới giới hạn ngành/rủi ro để đủ 5. Sửa hồ sơ sẽ hủy kết quả cũ.
- Có cách tự điền hồ sơ và tải hồ sơ/kết quả JSON.
- Giữ biểu mẫu khảo sát và PDF cũ trong tab Nhập biểu mẫu.
- Sửa tên thời hạn bị lệch giữa biểu mẫu cũ và bộ lọc.
- Phần demo mới không cần API; không gửi hồ sơ qua mạng.
- Phân nhóm cổ phiếu có sẵn chưa được xác minh theo thị trường hiện tại.
- Mô phỏng hồ sơ và bộ lọc quy tắc không được gọi là kết quả LLM trực tuyến.
- Chưa cập nhật website đang host trên GitHub: cần upload/commit file mới.

Hướng dẫn trình bày, tích hợp API và file cần thay: docs/DEMO_HOSO_HTD.md.
Kiểm tra: node --test tests/*.test.cjs (không gọi API).

Đã cập nhật:
- Tên công ty HTD SECURITIES trên các trang chính: trang chủ, giới thiệu, sản phẩm, quan hệ cổ đông, tin tức, hỗ trợ, ESG, cổ phiếu và báo cáo tư vấn.
- Tên sản phẩm, mã quỹ và bảng so sánh: chỉ đổi DOBN thành HTD.
- Trang chủ có ba giá trị H–T–D: Honest Insight. Thoughtful Strategy. Disciplined Investing.
- Bốn vị trí mở báo cáo cổ phiếu chuyển từ PDF sang PNG. Mã BID mở png/BIDV.png.
- Tên file báo cáo tư vấn tải xuống: HTD_Securities_Report.pdf. Báo cáo tư vấn khách hàng vẫn xuất PDF; báo cáo cổ phiếu mở PNG.
- Giữ nguyên số liệu, bố cục, tài nguyên hình ảnh và các địa chỉ email có trong bản ZIP bạn gửi.

Đã kiểm tra:
- Đủ 39 file báo cáo PNG và đường dẫn mở báo cáo khớp với từng mã.
- Cú pháp JavaScript của 11 trang chính và hàm xuất báo cáo.
- Hai trang danh sách cổ phiếu dựng đủ 39 thẻ với đường dẫn ảnh có thật.
- Không còn tên DOBN hiển thị trên 11 trang chính, ngoại trừ địa chỉ email cũ được giữ nguyên.

TÀI LIỆU CHƯA CÓ TRONG FILE GỐC:
- pdf/IPS.pdf
- pdf/AGM-2024-Minutes.pdf
- pdf/AGM-2025-Minutes.pdf
- pdf/AGM-2026-Notice.pdf
- pdf/DOBN-AnnualReport-2025.pdf
- pdf/DOBN-FinancialStatement-2025.pdf
- pdf/DOBN-Charter.pdf
- pdf/DOBN-Governance.pdf
- pdf/DOBN-DividendPolicy.pdf
Các nút tải tương ứng cần các file trên. Tên thư mục DOBN chứa ảnh và các URL có sẵn được giữ nguyên để tránh làm mất tài nguyên hoặc hỏng liên kết.
