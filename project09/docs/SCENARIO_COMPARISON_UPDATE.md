# So sánh ba phương án và mức giảm 0%

- Mức giảm thu nhập mặc định trên web: 0%; lựa chọn: 0%, 10%, 20%, 30%.
- 0% giữ nguyên giá trị cuối kỳ và thời điểm đạt mục tiêu so với trước giảm.
- Bảng so sánh chính hiển thị ngay: giả định thu nhập, chi tiêu linh hoạt, mức dành tiền, lợi suất thực dùng, số dư cuối kỳ, chênh lệch với cơ sở, thời điểm đạt và trạng thái đúng hạn.
- Bảng phép thử hiển thị cả ba phương án dưới cùng mức giảm thu nhập tạm thời.
- Các giả định của ba phương án tiếp tục dùng cấu hình cũ. Phép thử tạm thời tách biệt với các giả định kéo dài suốt thời hạn.
- Lợi suất có giới hạn theo mức rủi ro. Chế độ tự động không dành quá 100% dòng tiền dư.
- Báo cáo giữ phép thử cơ sở làm kết quả chính; hai phương án còn lại dùng để đối chiếu trên web.
- Cách chạy: giải nén, cài requirements.txt, chạy `streamlit run app.py`.

## Kiểm tra bản cập nhật

- Toàn bộ bộ kiểm tra: 482 passed.
- Kiểm tra tương tác: mặc định 0%, cả ba phương án giảm 0 đồng/chậm thêm 0 tháng; đổi sang 20% cập nhật kết quả và yêu cầu xác nhận lại; khôi phục thiết lập hoạt động.
- Biên dịch Python: thành công.
