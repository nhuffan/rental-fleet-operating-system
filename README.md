# Rental Fleet Operating System

Nền tảng quản lý hoạt động cho thuê xe và vận hành đội xe cho nhiều doanh nghiệp.

Hệ thống cung cấp đăng nhập, không gian làm việc theo doanh nghiệp, quản lý thành viên và phân quyền, chi nhánh, hồ sơ xe, thiết bị GPS, lịch sử gắn thiết bị, khách hàng, hợp đồng thuê và lịch bàn giao/nhận trả, vị trí GPS thử nghiệm qua Traccar, lịch sử hành trình và xem lại tuyến đường suy ra từ dữ liệu GPS, cài đặt và nhật ký thay đổi. Dữ liệu được phân tách theo doanh nghiệp ở API và cơ sở dữ liệu.

Superadmin cung cấp tổng quan và danh sách/chi tiết doanh nghiệp ở chế độ chỉ đọc, bằng quyền platform độc lập tại `/superadmin`.

Ứng dụng sử dụng Next.js cho Web, NestJS cho API và Supabase cho Auth, PostgreSQL và Storage; mã nguồn tổ chức theo pnpm monorepo. Tích hợp thiết bị GPS thực tế và các nghiệp vụ vận hành mở rộng sẽ được phát triển trên nền tảng này.

Sau khi điền cấu hình local theo [hướng dẫn phát triển](docs/development.md), chạy từ thư mục gốc:

```sh
pnpm install --frozen-lockfile
pnpm dev      # Chạy cả Web :4000 và API :9000
```

Chạy riêng từng app bằng `pnpm dev:web` và `pnpm dev:api`. Web: `http://localhost:4000`; API: `http://127.0.0.1:9000/api/v1`.

Hướng dẫn cấu hình, kiểm thử và ranh giới vận hành nằm trong [docs/development.md](docs/development.md). Kết quả tất cả các stage được tích lũy duy nhất tại [STAGE_OUTPUT.md](STAGE_OUTPUT.md).
