# Demo hồ sơ khách hàng trong web HTD

## Mở demo

Mở `customer.html` (Services) bằng Live Server, hoặc mở trực tiếp file. Chọn
tab **Demo hồ sơ khách hàng**. Phần mới dùng HTML/CSS/JavaScript cục bộ và
không cần API. Phông chữ, icon và PDF của biểu mẫu cũ vẫn phụ thuộc CDN.

1. Chọn một trong ba hồ sơ đầy đủ hoặc tình huống cần bổ sung.
2. Bấm **Xem bản nháp từ mô tả mẫu**.
3. Xem các trường và phần đối chiếu câu gốc. Sửa thông tin nếu cần.
4. Xác nhận hồ sơ rồi bấm **Lọc tối đa 5 mã theo hồ sơ**.
5. Xem lý do từng mã, mở ảnh báo cáo có sẵn hoặc tải kết quả JSON.

Sửa mô tả mẫu sẽ hủy bản nháp và kết quả. Demo không tự phân tích văn bản mới.
Chọn **Tự điền hồ sơ** để dùng dữ liệu riêng mà không giả lập khả năng LLM.
Sửa hồ sơ hoặc bỏ xác nhận sẽ hủy kết quả cũ và yêu cầu xác nhận lại.

## Phần được tái sử dụng từ cách làm của Project 9

- Mô tả → hồ sơ có cấu trúc → kiểm tra → người dùng xác nhận.
- Giá trị chưa cung cấp là `null`, không tự thay bằng 0.
- Giữ câu gốc để người dùng đối chiếu với bản nháp.
- Phân biệt nguồn mẫu, nhập tay và trạng thái xử lý thật.

Không chép toàn bộ Streamlit/Python, engine tiết kiệm, kịch bản, stress test
hoặc PDF của Project 9. Đây là triển khai JavaScript tương thích web HTD hiện có.

## Ranh giới giữa demo và AI thật

Trích xuất mẫu là tra cứu fixture, không phải phản hồi API đã ghi lại.
Lọc và xếp hạng là thuật toán ngoại tuyến, không phải lựa chọn của LLM.
Ba hồ sơ đầy đủ tạo danh sách khác nhau; trường hợp thiếu thông tin bị chặn.
Demo chứng minh luồng cá nhân hóa và kiểm tra dữ liệu, chưa đo độ chính xác LLM
hoặc hiệu quả đầu tư. Không dùng điểm demo như dự báo lợi nhuận.

## Dữ liệu và bộ lọc

Dùng 39 mã và phân nhóm có sẵn trong `js/recommendation.js`. Các nhãn rủi ro,
biến động, thời hạn chưa được xác minh với dữ liệu thị trường hiện tại. Không
sử dụng các tỷ suất kỳ vọng gán sẵn hoặc `fundamentalscore` để đưa ra dự báo.

Bộ lọc mới dùng mức chịu rủi ro, mục tiêu, thời hạn, kinh nghiệm, nhu cầu rút
tiền, ngành ưu tiên và ngành loại trừ. Vốn dành riêng được xác nhận và hiển thị;
chưa dùng vốn để tính số lượng cổ phiếu, mức đủ tiền mua hay phân bổ danh mục.
Nhãn thời hạn trong pool chỉ đóng góp điểm, không đồng nghĩa ngắn hạn là rủi ro cao.

Giới hạn minh họa, không phải chuẩn suitability đã được kiểm định:

- Không vượt nhóm rủi ro người dùng xác nhận.
- Người mới bắt đầu hoặc nhu cầu rút tiền trung bình: tối đa nhóm Balanced.
- Mục tiêu bảo toàn vốn: chỉ xét Conservative, vẫn cảnh báo không bảo đảm vốn.
- Từ 6 tháng trở xuống hoặc nhu cầu rút tiền cao: không trả danh sách.
- Mục tiêu thu nhập: không trả danh sách vì pool chưa có dữ liệu cổ tức.
- Loại ngành muốn tránh; tối đa 2 mã mỗi ngành; tối đa 5 mã, không bù bắt buộc.

Điểm /100 là phép cộng minh bạch: 50 cơ bản +20 khớp nhóm rủi ro ưu tiên
+20 thuộc ngành ưu tiên +10 khớp nhãn thời hạn. Điểm không đo chất lượng doanh
nghiệp hay xác suất sinh lời. Khi đồng điểm, sắp theo mã để kết quả tái lập.

## Lần tích hợp API sau

Thay `extractDemo` bằng endpoint backend trả hồ sơ cùng evidence, trường thiếu
và nhãn nguồn `live_llm`. Không đặt khóa API trong JS hoặc GitHub Pages.
Prompt/schema mới cần vốn cổ phiếu riêng, mục tiêu, thời hạn, rủi ro, nhu cầu
rút tiền, kinh nghiệm và ngành; không lấy tiết kiệm thành vốn mặc định.

Nếu bổ sung LLM xếp hạng: gửi tập ứng viên đã vượt bộ lọc cùng hồ sơ được
xác nhận; chỉ nhận tối đa 5 mã trong tập, kèm lý do và bằng chứng dữ liệu.
Kiểm tra mã không trùng, giới hạn ngành và các ràng buộc sau khi LLM trả về.
Lỗi API cần báo rõ và chỉ chuyển sang quy tắc với nhãn nguồn tương ứng.

## Kiểm tra

`node --test tests/*.test.cjs`

Kiểm tra trích xuất mẫu, dữ liệu thiếu/sai, xác nhận, giới hạn ngành/rủi ro,
không ép đủ 5, cá nhân hóa, tính tái lập và đường dẫn ảnh báo cáo/logo.
Kiểm tra trạng thái UI bằng DOM giả lập không thay thế QA trình duyệt/hiển thị.

## Lời trình bày ngắn với giảng viên

“Demo mô phỏng đầu ra trích xuất của LLM từ các tình huống chuẩn bị sẵn.
Phần kiểm tra hồ sơ và lọc cổ phiếu chạy trực tiếp bằng quy tắc. Khách hàng
xác nhận hồ sơ trước khi lọc. Hệ thống không tự điền dữ liệu thiếu, không
chọn thêm mã chỉ để đủ năm và hủy kết quả khi hồ sơ thay đổi. Kết nối LLM
trực tuyến và kiểm chứng dữ liệu thị trường là bước nghiệm thu tiếp theo.”

## Cập nhật lên web đang chạy

Thay file `customer.html`, `js/recommendation.js`; thêm `css/profile-demo.css`,
`js/htd-profile-core.js`, `js/htd-profile-ui.js`. Giữ các thư mục ảnh/logo hiện có.
Với GitHub Pages, commit/upload các file này lên repository đang dùng và chờ
deployment. Gói tải về chưa tự thay đổi website đang host trên GitHub.
