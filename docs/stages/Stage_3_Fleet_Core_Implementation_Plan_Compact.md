# Stage 3 — Fleet Core Implementation

## Goal

Chuyển **Vehicles** từ UI preview sang chức năng thật: quản lý Vehicle, GPS Device và lịch sử Device Assignment theo từng Business. **Chưa tích hợp GPS realtime/Traccar hoặc Rental.**

## Scope

**In:** Vehicle CRUD, Branch association, lifecycle status, GPS Device registry, Device Assignment, tenant isolation, RBAC, audit, API/OpenAPI contracts, live Vehicles UI và tests.

**Out:** Customer/Rental, booking availability, GPS ingestion/location/map, Trips, Commercial, Superadmin global APIs.

## Implementation Tasks

### S3-01 — Schema & Migration
- [ ] Tạo SQL migration cho `vehicles`, `gps_devices`, `device_assignments` và constraints/indexes cần thiết.
- [ ] Vehicle thuộc `business_id`; Branch phải cùng Business.
- [ ] GPS Device có provider + unique device UID; xác định rõ ownership để tránh cross-tenant assignment.
- [ ] Assignment lưu `assigned_at` / `unassigned_at`, bảo toàn history; ngăn trùng active assignment theo rule đã chọn.
- [ ] Cập nhật Drizzle schema; bật RLS theo chính sách hiện tại. Không tạo hệ thống migration thứ hai.

### S3-02 — Domain Rules
- [ ] Tách Vehicle khỏi GPS Device và Device Assignment.
- [ ] Xác định lifecycle status thực sự lưu (`ACTIVE`/`INACTIVE` hoặc model tương đương); không gán `AVAILABLE`/`RENTED` khi Rental Core chưa tồn tại.
- [ ] Chặn biển số trùng trong Business theo policy xác định; chuẩn hóa định dạng/validation.
- [ ] Không cho assign device/vehicle khác Business; không xóa history khi đổi tracker.
- [ ] Xác định archive/disable thay cho hard-delete khi có dependencies.

### S3-03 — NestJS API
- [ ] `GET /vehicles`, `GET /vehicles/:id`, `POST /vehicles`, `PATCH /vehicles/:id`.
- [ ] `GET /gps-devices`, `POST /gps-devices`, `PATCH /gps-devices/:id`.
- [ ] `GET /vehicles/:id/device-assignments`, `POST /vehicles/:id/device-assignments`, endpoint kết thúc assignment.
- [ ] Tenant scope, permissions, pagination/filter/sort, validation và error codes đồng bộ convention có sẵn.
- [ ] Các write quan trọng và audit event trong transaction; tránh race condition khi assign đồng thời.
- [ ] Cập nhật Swagger/OpenAPI và generated contracts.

### S3-04 — Business Admin UI
- [ ] Kết nối `/app/vehicles` với API thật, loại bỏ fixture khỏi production path.
- [ ] Vehicle list: search/filter/status/branch, pagination, empty/loading/error.
- [ ] Vehicle detail: hồ sơ, Branch, lifecycle status, GPS Device hiện gắn và assignment history.
- [ ] Create/Edit Vehicle và Assign/Unassign GPS Device qua form/drawer với validation, permission và feedback.
- [ ] Giữ nguyên design system, shell, auth và tenant switch; không hiển thị vị trí/GPS online giả.

### S3-05 — Verification
- [ ] Migration replay trên DB sạch; constraints/indexes hoạt động.
- [ ] Tests: cross-tenant read/write, invalid Branch, duplicate plate, duplicate device UID, concurrent assignment, reassign history, role permissions và audit.
- [ ] E2E trên **development Supabase**: tạo Vehicle → đăng ký Device → assign → unassign → reassign → kiểm tra lịch sử.
- [ ] Chạy `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, và `pnpm test:e2e` khi môi trường dev đã sẵn sàng.
- [ ] Kiểm tra không phát sinh regression ở SaaS Core và production preview boundaries.

## Acceptance Criteria

- [ ] OWNER/ADMIN hoặc role có permission phù hợp quản lý Vehicle và GPS Device qua UI thật.
- [ ] Không thể xem/chỉnh sửa/gán dữ liệu của Business khác, kể cả sửa ID/API request.
- [ ] Một Vehicle không có nhiều primary active GPS assignments cùng lúc; lịch sử gán không bị mất.
- [ ] Branch và Vehicle được xác thực cùng tenant.
- [ ] `/app/vehicles` hiển thị dữ liệu thật và trạng thái lỗi/loading/empty chính xác.
- [ ] Không có mock telemetry, fake live map, hoặc Rental status giả trong production.
- [ ] Migrations, API contracts, audit và tests đều được cập nhật.

## Deliverables

1. SQL migration + Drizzle mapping.
2. NestJS Fleet/GPS Device/Assignment API + OpenAPI contracts.
3. Business Admin Vehicles UI chạy dữ liệu thật.
4. Unit/integration/E2E tests và kết quả xác minh.
5. Cập nhật `STAGE_OUTPUT.md` với phần đã làm, chưa làm, kết quả test; không đánh dấu hoàn tất nếu chưa đạt acceptance.

## Execution Order

`Schema → Rules → API → OpenAPI → UI → Tests/QA → STAGE_OUTPUT.md`

**Next:** Rental Core; GPS ingestion/Traccar là stage riêng. Superadmin production backend là workstream độc lập.
