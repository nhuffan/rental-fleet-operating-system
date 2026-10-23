# Rental Fleet Operating System

Nền tảng quản lý hoạt động cho thuê xe và vận hành đội xe cho nhiều doanh nghiệp.

Hệ thống cung cấp đăng nhập, không gian làm việc theo doanh nghiệp, quản lý thành viên và phân quyền, chi nhánh, hồ sơ xe, thiết bị GPS, lịch sử gắn thiết bị, khách hàng, hợp đồng thuê và lịch bàn giao/nhận trả, vị trí GPS thử nghiệm qua Traccar, lịch sử hành trình và xem lại tuyến đường suy ra từ dữ liệu GPS, cài đặt và nhật ký thay đổi. Dữ liệu được phân tách theo doanh nghiệp ở API và cơ sở dữ liệu.

Ứng dụng sử dụng Next.js cho Web, NestJS cho API và Supabase cho Auth, PostgreSQL và Storage; mã nguồn tổ chức theo pnpm monorepo. Tích hợp thiết bị GPS thực tế và các nghiệp vụ vận hành mở rộng sẽ được phát triển trên nền tảng này.

Hướng dẫn phát triển và ranh giới vận hành nằm trong [docs/development.md](docs/development.md). Kế hoạch và kết quả đợt hiện tại nằm trong [Stage 6](docs/stages/Stage_6_Trip_History_and_Codebase_Refactor_Compact.md).
