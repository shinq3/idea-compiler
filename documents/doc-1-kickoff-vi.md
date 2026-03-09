# Tài liệu Khởi động

## Bối cảnh / Mục tiêu
- Để giải quyết vấn đề khó khăn trong việc theo dõi quyết định và điểm chính trong cuộc họp do không thể nắm bắt các quyết định và ToDo, chúng tôi sẽ xây dựng nền tảng tạo tóm tắt cuộc họp sử dụng công nghệ nhận diện giọng nói và AI tạo ra (Tóm tắt Dự án) (Input #0).  
- Sẽ kết hợp các tóm tắt của nhiều cuộc họp và triển khai RAG (Retrieval-Augmented Generation) để tham khảo bối cảnh của các cuộc họp trước đó khi cần thiết (Input #1).  
- Các mục tiêu cụ thể để thực hiện trên:  
  1. Kết hợp nhận diện giọng nói bằng công nghệ Whisper dựa trên tải lên và API thời gian thực, tạo tóm tắt cuộc họp có khả năng hình dung và chia sẻ các quyết định, điểm chính, và hành động một cách hiệu quả (Input #0).  
  2. Thực hiện ghi âm dự phòng ở thiết bị micro để chuẩn bị cho những lần thất bại trong việc thu âm, giảm thiểu rủi ro mất dữ liệu (Input #5).  
  3. Tự động tạo tài liệu khởi động dự án và đề xuất tính năng, nhằm chuẩn hóa khởi động dự án và cải thiện chất lượng (Input #4).  

## Thách thức hiện tại (kèm bằng chứng)
- Các quyết định và tóm tắt trong cuộc họp phụ thuộc vào cá nhân, dẫn đến sự chậm trễ và rủi ro rò rỉ thông tin (Vấn đề: Thiếu nắm bắt tóm tắt và quyết định cuộc họp) (Input #4).  
- Chất lượng tóm tắt không ổn định do độ chính xác của nhận diện giọng nói thay đổi do tiếng ồn, nhiều người nói và từ chuyên môn (Tóm tắt Dự án) (Input #0).  
- Có sự đánh đổi giữa chi phí và hiệu suất do lựa chọn phương thức nhận diện giọng nói (tải lên vs API thời gian thực) (Tóm tắt Dự án) (Input #0).  
- Nếu không đồng bộ với quy trình ghi biên bản và phê duyệt hiện có, sẽ khó đưa vào thực tiễn và khó duy trì (Tóm tắt Dự án) (Input #0).  
- Nếu dự phòng không đủ trong trường hợp thất bại trong thu âm, sẽ không thể phiên dịch và trực tiếp dẫn đến mất dữ liệu (Rủi ro: Thất bại trong việc thu âm) (Input #5).  
- Các mẫu và chất lượng sản phẩm kỳ vọng khác nhau giữa các bộ phận, có nguy cơ mở rộng yêu cầu (Tóm tắt Dự án) (Input #0).  

## Mục tiêu / Sản phẩm
- Báo cáo PoC: Kết quả đánh giá so sánh độ chính xác và chi phí của phương thức nhận diện Whisper tải lên và API thời gian thực (Tóm tắt Dự án) (Input #0).  
- Phát hành MVP:  
  1. Tạo tóm tắt cuộc họp (bao gồm tóm tắt, trích xuất quyết định/ToDo, phụ đề trực tiếp)  
  2. Chức năng sao lưu ghi âm vào thiết bị micro  
  3. Hỗ trợ tự động tạo tài liệu khởi động và đề xuất tính năng  
  (Tóm tắt Dự án) (Input #0).  
- Tài liệu định nghĩa mẫu tóm tắt tiêu chuẩn (các mục bắt buộc, độ chi tiết, định dạng đầu ra) (Tóm tắt Dự án) (Input #0).  
- Kế hoạch phát hành từng giai đoạn: MVP → Mở rộng mẫu → Giai đoạn hợp tác bên ngoài & tăng cường vận hành (Tóm tắt Dự án) (Input #0).  

## Phạm vi (Có / Không)
**Có trong phạm vi** (Tóm tắt Dự án) (Input #0):  
1. Tạo tóm tắt cuộc họp bằng phương thức Whisper tải lên / API thời gian thực (bao gồm tóm tắt, trích xuất quyết định/ToDo, hiển thị phụ đề trực tiếp)  
2. Chức năng sao lưu ghi âm vào thiết bị micro  
3. Hỗ trợ tự động tạo tài liệu khởi động dự án và đề xuất tính năng  

**Không nằm trong phạm vi** (Tóm tắt Dự án) (Input #0):  
- Tích hợp công cụ hội nghị (Zoom/Teams, v.v.)  
- Kích hoạt ghi âm tự động  
- Tích hợp công cụ quản lý tác vụ  
- Quy trình phê duyệt, quản lý quyền truy cập / nhật ký kiểm tra  
- Xác định yêu cầu chi tiết cho các mẫu  
- Xây dựng hệ thống bảo trì vận hành (cần xác nhận)  

## Cấu trúc đội ngũ (Vai trò)
- Nhà tài trợ dự án / Ủy ban điều hành  
- Quản lý dự án  
- Kỹ sư AI/ML (chuyên môn nhận diện giọng nói và thực hiện RAG)  
- Kỹ sư backend (thiết kế API và lưu trữ dữ liệu)  
- Kỹ sư frontend (thực hiện phụ đề trực tiếp / UI)  
- Kỹ sư bảo mật / hạ tầng (thời gian lưu trữ, kiểm soát truy cập)  
- Nhà thiết kế UX (Giao diện tạo tóm tắt / tài liệu)  
- QA / Tester (thử nghiệm độ chính xác & hiệu suất)  
- Nhà phân tích kinh doanh (định nghĩa yêu cầu & khảo sát người dùng)  

## Kế hoạch cột mốc
| Giai đoạn       | Kết quả chính                             | Thời gian dự kiến  |
|--------------|---------------------------------------|------------------|
| PoC          | Báo cáo đánh giá so sánh phương pháp nhận diện               | T+4 tuần         |
| MVP          | Tạo tóm tắt + ghi âm cục bộ + chức năng tự động tạo tài liệu | T+12 tuần        |
| Chuẩn hóa mẫu   | Mẫu tóm tắt tiêu chuẩn / định nghĩa đầu ra         | T+14 tuần        |
| Hợp tác bên ngoài & tăng cường vận hành | Định nghĩa yêu cầu tích hợp công cụ / hướng dẫn vận hành | T+20 tuần        |

(T = thời điểm bắt đầu dự án)

## Rủi ro chính và biện pháp giảm thiểu
| Rủi ro                   