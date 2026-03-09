# Đề xuất tính năng

## Danh sách tính năng (Must / Should / Could)

### Must
- **Chức năng tạo tóm tắt cuộc họp bằng đầu vào giọng nói**  
  - Mục đích: Tự động sinh tóm tắt cuộc họp bao gồm điểm chính, mục quyết định, nội dung thảo luận và hành động tiếp theo dựa trên âm thanh.  
  - Người dùng mục tiêu: Người tham gia cuộc họp, quản lý dự án và thành viên nhóm cần biên bản kịp thời.  
  - Bằng chứng: Yêu cầu từ Input #4; Project Summary “scope”.

- **Tính năng tạo tài liệu khi khởi động dự án**  
  - Mục đích: Tự động tạo tài liệu khởi động và đề xuất chức năng khi khởi động dự án.  
  - Người dùng mục tiêu: Trưởng dự án, bên liên quan và PMO.  
  - Bằng chứng: Yêu cầu từ Input #4; Project Summary “scope”.

- **Giới thiệu RAG**  
  - Mục đích: Cung cấp khả năng RAG (Retrieval-Augmented Generation) để hỗ trợ tóm tắt nâng cao và hợp nhất tóm tắt từ nhiều cuộc họp.  
  - Người dùng mục tiêu: Quản lý tri thức, chuyên gia phân tích tích hợp dữ liệu đa phiên.  
  - Bằng chứng: Yêu cầu từ Input #7.

- **Tích hợp bản tóm tắt cuộc họp**  
  - Mục đích: Hợp nhất các bản tóm tắt từ nhiều cuộc họp thành một tài liệu duy nhất.  
  - Người dùng mục tiêu: Nhóm có lịch họp nhiều giai đoạn hoặc định kỳ.  
  - Bằng chứng: Yêu cầu từ Input #7.

- **Ghi âm sao lưu cục bộ**  
  - Mục đích: Đảm bảo ghi âm được lưu cục bộ trên phần cứng micro làm bản sao lưu trong trường hợp thu giọng nói thất bại.  
  - Người dùng mục tiêu: Tất cả người tham gia cuộc họp và quản trị viên hệ thống chịu trách nhiệm về tính toàn vẹn dữ liệu.  
  - Bằng chứng: Yêu cầu từ Input #5; Rủi ro “Ghi âm giọng nói thất bại” (Input #5).

### Should
- **Hiển thị phụ đề trực tiếp qua API thời gian thực**  
  - Mục đích: Hiển thị phụ đề trực tiếp trong cuộc họp để nắm bắt ngay lập tức và cải thiện khả năng truy cập.  
  - Người dùng mục tiêu: Người tham gia từ xa, người khiếm thính và điều phối viên cuộc họp.  
  - Bằng chứng: Thảo luận trong Input #2; Project Summary “scope”.

- **Lựa chọn phương thức phiên âm**  
  - Mục đích: Cho phép chọn giữa phương pháp upload Whisper và API thời gian thực, cân bằng độ tin cậy và tính tức thời.  
  - Người dùng mục tiêu: Quản trị viên IT và chủ sản phẩm.  
  - Bằng chứng: Quyết định từ Input #5; Ràng buộc “Chi phí API thời gian thực” (Input #5).

### Could
- **Chức năng liên kết bên ngoài (Tùy chọn)**  
  - Mục đích: Xem xét tích hợp với các trang thương mại điện tử và trang mua vé trong Giai đoạn 2.  
  - Người dùng mục tiêu: Nhóm phát triển kinh doanh và người phụ trách tích hợp bên thứ ba.  
  - Bằng chứng: Yêu cầu từ Input #8.

- **Xuất bản tóm tắt cuộc họp**  
  - Mục đích: Xuất tóm tắt ra PDF, DOCX hoặc Markdown để chia sẻ và lưu trữ.  
  - Người dùng mục tiêu: Chuyên gia tài liệu và nhân viên tuân thủ.  
  - Bằng chứng: Đề xuất tính năng từ Project Summary.

- **Chỉnh sửa và tái tạo tóm tắt**  
  - Mục đích: Cho phép chỉnh sửa thủ công và AI tái tạo tóm tắt theo hướng dẫn người dùng.  
  - Người dùng mục tiêu: Người tổ chức cuộc họp và người xem xét nội dung.  
  - Bằng chứng: Đề xuất tính năng từ Project Summary.

## Phụ thuộc
- Engine phiên âm Whisper (upload)  
- API phiên âm thời gian thực (chờ xác nhận chi phí) [Input #5]  
- Phần cứng micro với khả năng lưu trữ cục bộ [Input #5]  
- Hạ tầng RAG và lưu trữ chỉ số (đám mây hoặc tại chỗ) [Chưa giải quyết]  
- Thư viện mẫu tài liệu khởi động và đề xuất  
- Khung xác thực và bảo mật  

## Tiêu chí chấp nhận
1. Tóm tắt cuộc họp được sinh ra trong vòng 1 phút sau khi upload âm thanh, bao gồm điểm chính, quyết định và hành động tiếp theo.  
2. Tài liệu khởi động và đề xuất chức năng được tạo theo mẫu chuẩn, với cấu trúc chương chính xác.  
3. Ghi âm sao lưu cục bộ được thực hiện cho mọi cuộc họp và khôi phục thành công trong kịch bản thất bại.  
4. Hợp nhất bằng RAG kết hợp ít nhất 3 bản tóm tắt cuộc họp thành một tài liệu duy nhất mà không mất ngữ cảnh.  
5. Phụ đề trực tiếp đạt ≥90% độ chính xác trong môi trường kiểm soát (giai đoạn MVP).  

## Các mục loại trừ
- Tích hợp với Zoom, Teams hoặc công cụ hội nghị khác (Giai đoạn 2) [Project Summary “scope”]  
- Tích hợp với trang thương mại điện tử và vé trong giai đoạn đầu [Input #8]  
- Quy trình phê duyệt, quản lý quyền hạn và nhật ký kiểm tra [Project Summary “scope”]  
- Xác định yêu cầu chi tiết mẫu và thiết lập vận hành [Project Summary “scope”]  

## Các mục chưa giải quyết (Cần điều tra thêm)
- Phạm vi chi phí liên tục cho API thời gian thực [Chưa giải quyết]  
- Lưu trữ chỉ số RAG và yêu cầu hạ tầng tìm kiếm [Chưa giải quyết]  
- Độ thô và phạm vi thời gian cho tóm tắt hợp nhất [Chưa giải quyết]  
- Hỗ trợ ngôn ngữ và từ điển thuật ngữ chuyên ngành [Chưa giải quyết]  
- Mẫu hiện có cho tài liệu khởi động và đề xuất có sẵn hay không [Chưa giải quyết]  
- Quy trình phê duyệt/xem xét cuối cùng [Chưa giải quyết]  
- Số lượng người dùng, số cuộc họp hàng tháng và thời lượng ghi âm trung bình [Chưa giải quyết]  
- Chỉ số thành công (giảm thời gian tạo biên bản, giảm độ trễ chia sẻ quyết định, v.v.)