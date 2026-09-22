# Rental Fleet Operating System

Hệ thống hỗ trợ quản lý hoạt động cho thuê xe và vận hành đội xe, với định hướng mở rộng cho nhiều doanh nghiệp trên cùng nền tảng.

Dự án hướng đến quản lý xe, hợp đồng thuê và theo dõi đội xe/GPS. Hiện tại dự án đã hoàn thành nền tảng kỹ thuật Stage 1; các chức năng nghiệp vụ sẽ được triển khai ở các giai đoạn tiếp theo.

Nền tảng sử dụng Next.js cho ứng dụng web, NestJS cho backend và Supabase cho PostgreSQL, Auth và Storage. Mã nguồn được tổ chức theo monorepo với pnpm workspace, theo kiến trúc modular monolith và định hướng phân tách dữ liệu doanh nghiệp bằng business_id.
