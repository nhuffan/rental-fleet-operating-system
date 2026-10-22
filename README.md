# Rental Fleet Operating System

Nền tảng quản lý hoạt động cho thuê xe và vận hành đội xe cho nhiều doanh nghiệp.

Hệ thống cung cấp đăng nhập, không gian làm việc theo doanh nghiệp, quản lý thành viên và phân quyền, chi nhánh, hồ sơ xe, thiết bị GPS, lịch sử gắn thiết bị, cài đặt và nhật ký thay đổi. Dữ liệu được phân tách theo doanh nghiệp ở API và cơ sở dữ liệu.

Ứng dụng sử dụng Next.js cho Web, NestJS cho API và Supabase cho Auth, PostgreSQL và Storage; mã nguồn tổ chức theo pnpm monorepo. Hợp đồng thuê và dữ liệu GPS realtime sẽ được phát triển trên nền tảng này.

Kết quả triển khai theo từng file stage được ghi tại [STAGE_OUTPUT.md](STAGE_OUTPUT.md).
