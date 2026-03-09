# Đề xuất Tính năng

## Danh sách Tính năng (Phải có / Nên có / Có thể có)

### Phải có
1. **Nhận diện giọng nói dựa trên Whisper có thể tải lên**  
   - Mục đích: Tải lên tệp ghi âm sau cuộc họp và thực hiện chuyển đổi thành văn bản với độ chính xác cao  
   - Người dùng mục tiêu: Người phụ trách biên bản cuộc họp, Thành viên dự án  
   - Chứng cứ:  
     - "Phương pháp nhận diện giọng nói được thực hiện bằng Whisper" (Dữ liệu đầu vào #2)  
     - Yêu cầu "Nhận diện giọng nói dựa trên Whisper có thể tải lên" (Các mục có cấu trúc [yêu cầu] Dữ liệu đầu vào #5)

2. **Nhận diện giọng nói theo thời gian thực qua API và hiển thị phụ đề trực tiếp**  
   - Mục đích: Thực hiện ghi chép và hiển thị phụ đề theo thời gian thực trong cuộc họp, nhằm giúp nắm bắt thảo luận ngay lập tức  
   - Người dùng mục tiêu: Người tham gia cuộc họp (đặc biệt là những người tham gia từ xa), Người điều phối  
   - Chứng cứ:  
     - "Với API thời gian thực... có thể nắm bắt ngay lập tức" (Dữ liệu đầu vào #2)  
     - Quyết định "Lựa chọn Phương pháp Ghi chép" (Dữ liệu đầu vào #5)

3. **Chức năng sao lưu ghi âm cục bộ trên chính microphone**  
   - Mục đích: Lưu trữ dữ liệu ghi âm trong microphone để giảm thiểu rủi ro mất dữ liệu trong trường hợp ghi âm không thành công  
   - Người dùng mục tiêu: Quản trị viên CNTT, Người phụ trách biên bản cuộc họp  
   - Chứng cứ:  
     - Yêu cầu "Ghi âm sao lưu cục bộ" (Các mục có cấu trúc [yêu cầu] Dữ liệu đầu vào #5)  
     - Rủi ro "Lỗi ghi âm giọng nói" (Các mục có cấu trúc [rủi ro] Dữ liệu đầu vào #5)

4. **Chức năng tạo tóm tắt cuộc họp (Trích xuất điểm chính, quyết định, vấn đề, hành động tiếp theo)**  
   - Mục đích: Tự động tạo tóm tắt từ kết quả nhận diện giọng nói và trình bày các quyết định và ToDo theo cách có cấu trúc  
   - Người dùng mục tiêu: Tất cả thành viên dự án, Quản lý  
   - Chứng cứ:  
     - Yêu cầu "Chức năng tạo tóm tắt cuộc họp từ đầu vào giọng nói" (Các mục có cấu trúc [yêu cầu] Dữ liệu đầu vào #4)  
     - Ứng viên tính năng "Tạo biên bản cuộc họp/tóm tắt cuộc họp từ giọng nói" (Tóm tắt dự án)

5. **Tích hợp tóm tắt cuộc họp (Áp dụng RAG)**  
   - Mục đích: Tập hợp tóm tắt của nhiều cuộc họp để có thể trích xuất các điểm chính một cách đồng nhất nhằm củng cố bối cảnh  
   - Người dùng mục tiêu: Người dẫn dắt dự án, Người phụ trách quản lý tri thức  
   - Chứng cứ:  
     - Yêu cầu "Tích hợp tóm tắt cuộc họp" (Các mục có cấu trúc [yêu cầu] Dữ liệu đầu vào #7)  
     - Yêu cầu "Áp dụng RAG" (Các mục có cấu trúc [yêu cầu] Dữ liệu đầu vào #7)

6. **Tự động tạo tài liệu đề xuất chức năng và tài liệu khởi động dự án**  
   - Mục đích: Giảm tải công việc tạo tài liệu khi khởi động dự án và tự động tạo ra các tài liệu có chất lượng tiêu chuẩn hóa  
   - Người dùng mục tiêu: PMO, Quản lý dự án  
   - Chứng cứ:  
     - Yêu cầu "Chức năng tạo tài liệu khi khởi động dự án" (Các mục có cấu trúc [yêu cầu] Dữ liệu đầu vào #4)  

### Nên có
1. **Chức năng chỉnh sửa, bổ sung, tái tạo tóm tắt**  
   - Mục đích: Thêm hoặc sửa đổi bổ sung vào tóm tắt được tự động tạo ra thông qua việc chỉ định prompt  
   - Người dùng mục tiêu: Người phụ trách biên bản cuộc họp, Người kiểm tra cấp trên  
   - Chứng cứ: Ứng viên tính năng "Chỉnh sửa, tái tạo tóm tắt" (Tóm tắt dự án)

2. **Trích xuất và chia nhỏ quyết định, ToDo (Hỗ trợ nhập liệu người phụ trách/thời hạn)**  
   - Mục đích: Cung cấp giao diện dễ dàng để nhập người phụ trách và thời hạn cho các mục hành động đã trích xuất  
   - Người dùng mục tiêu: Thành viên dự án, PMO  
   - Chứng cứ: Ứng viên tính năng "Trích xuất và chia nhỏ quyết định, ToDo" (Tóm tắt dự án)

3. **Chức năng chia sẻ tóm tắt cuộc họp (Chia sẻ URL, xuất PDF/Docx/Markdown)**  
   - Mục đích: Cho phép chia sẻ và phân phối tóm tắt được tạo ra dưới nhiều định dạng khác nhau  
   - Người dùng mục tiêu: Tất cả người tham gia cuộc họp, Bên liên quan bên ngoài  
   - Chứng cứ: Ứng viên tính năng "Chia sẻ tóm tắt cuộc họp" (Tóm tắt dự án)

### Có thể có
1. **Chức năng quản lý mẫu (Đăng ký và áp dụng định dạng chuẩn nội bộ)**  
   - Mục đích: Tiếp nhận sự khác biệt định dạng giữa các phòng ban và quản lý các mẫu đã tiêu chuẩn hóa trong nội bộ  
   - Người dùng mục tiêu: PMO, Người quản lý tài liệu  
   - Chứng cứ: Tóm tắt dự án "Chất lượng yêu cầu đối với các mẫu và sản phẩm tạo ra khác nhau giữa các phòng ban" (rủi ro)

2. **Chức năng quản lý lịch sử (Quản lý phiên bản, hiển thị sự khác biệt)**  
   - Mục đích: Giúp theo dõi và quản lý các phiên bản khác nhau của tài liệu về cuộc họp và các tóm tắt khác.