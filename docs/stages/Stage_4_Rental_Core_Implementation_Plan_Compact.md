# Stage 4 — Customer & Rental Core Implementation

**Source baseline:** `main` commit `4b8baa2e4e7a9b1d8242f65f21dfb7926b44ca94` (22/10/2026). Read `STAGE_OUTPUT.md` before implementation; if `main` has advanced, reconcile first.

## Goal

Đưa **Customers + Rentals** từ preview sang chức năng thật; hỗ trợ đặt xe, bàn giao, kích hoạt, gia hạn, nhận trả, hoàn thành/hủy và phát hiện lịch trùng. Tận dụng `vehicles` và tenant/RBAC/audit của Stage 3.

## Scope

**In:** Customer CRUD, Rental lifecycle, time-based vehicle availability, derived overdue, odometer at handover/return, basic rental amount, tenant-safe APIs, live UI, tests.

**Out:** GPS ingestion/realtime map/Trip, Toll/VETC, payment gateway, full accounting/P&L, advanced pricing, customer portal, Superadmin global API. **Deposit:** chỉ lưu `deposit_required_amount` và trạng thái/thông tin nhận cọc đơn giản nếu cần cho Rental UI; không xây payment/refund ledger hay đối soát trong stage này.

## Implementation Tasks

### S4-01 — Schema & Migration
- [ ] Tạo `customers`, `rentals` bằng Supabase SQL migration; cập nhật Drizzle mapping, composite tenant FKs, RLS, indexes và constraints.
- [ ] `customers`: tên, liên hệ tối thiểu, status, `business_id`; xác định validation/unique policy phù hợp, tránh hard-delete khi đã có rentals.
- [ ] `rentals`: `business_id`, `customer_id`, `vehicle_id`, `start_at`, `end_at`, `status`, `rental_amount`, các mốc handover/return, odometer start/end, notes và timestamps cần thiết.
- [ ] Dùng `timestamptz` UTC; đảm bảo `end_at > start_at`, tiền không âm, odometer return không nhỏ hơn handover. Kiểm tra foreign keys cùng tenant.
- [ ] Định nghĩa DB strategy chống **overlapping reservations** (không chỉ frontend validation), phù hợp trạng thái blocking; có migration replay tests.

### S4-02 — Domain Rules
- [ ] Lifecycle canonical: `DRAFT → RESERVED → ACTIVE → COMPLETED`; `DRAFT/RESERVED → CANCELLED`. **Handover** và **Return** là validated actions/timestamps, không nhất thiết là persisted statuses mới.
- [ ] `OVERDUE` là derived condition (`ACTIVE` và quá `end_at`), không ghi thành rental status.
- [ ] Mỗi rental gắn một Vehicle + một Customer; không đổi Vehicle/Customer tùy tiện sau khi ACTIVE.
- [ ] Reservation conflict tính theo khoảng `[start_at, end_at)` của rental đang chặn lịch; reject cả tạo mới và gia hạn bị overlap. Không cho đặt xe `INACTIVE`.
- [ ] Vehicle **effective availability** được tính từ lifecycle `ACTIVE/INACTIVE` + reservation/active rental, không sửa `vehicles.status` thành `RENTED` hoặc `AVAILABLE`.
- [ ] Handover lưu start odometer rồi activate; Return lưu end odometer rồi complete; mọi transition có kiểm tra trạng thái, quyền, idempotency/conflict và audit.

### S4-03 — NestJS API & Security
- [ ] Customers: `GET /customers`, `GET /customers/:id`, `POST /customers`, `PATCH /customers/:id`.
- [ ] Rentals: `GET /rentals`, `GET /rentals/:id`, `POST /rentals`, `PATCH /rentals/:id` (chỉ các trường hợp hợp lệ).
- [ ] Actions: `POST /rentals/:id/reserve`, `/handover`, `/extend`, `/return`, `/cancel` hoặc endpoint tương đương nhất quán, document rõ contracts.
- [ ] `GET /vehicles/availability?startAt=...&endAt=...` (hoặc API availability tương đương) để UI lọc xe trước khi đặt; **backend phải recheck khi write**.
- [ ] Bổ sung `customer.read/manage`, `rental.read/manage` vào permission matrix; OWNER/ADMIN manage, OPERATIONS theo scope được quyết định trong Stage 4 và kiểm thử đầy đủ.
- [ ] Reuse verified tenant context, business lock/transaction & atomic audit từ Stage 3; khóa/ràng buộc chống concurrent overlap, không tin status do client gửi.
- [ ] Pagination/filter/search, stable errors, OpenAPI và generated contracts.

### S4-04 — Business Admin UI (Live)
- [ ] Chuyển `/app/customers` sang API thật: list/search/create/edit/detail/empty/loading/error.
- [ ] Chuyển `/app/rentals` sang API thật: list/filter, create reservation wizard, rental detail, lifecycle timeline, handover/return/extend/cancel actions.
- [ ] Form chọn Vehicle theo date range + availability; hiển thị lý do conflict từ server khi tranh chấp.
- [ ] Tích hợp current/next Rental vào Vehicle Detail; hiển thị `AVAILABLE/RESERVED/RENTED/OVERDUE` là **derived display state**, phân biệt với Vehicle lifecycle và GPS status.
- [ ] Dashboard schedule + active rental queue nối dữ liệu Rental thật nếu API đủ; nếu chưa đủ, giữ các phần chưa kết nối dưới development preview, **không để fixtures lọt production**.
- [ ] Giữ auth, tenant switch, responsive design system, permission-aware action và mutation feedback.

### S4-05 — Verification
- [ ] Migration replay + database constraints (tenant FK, date range, overlap, state values).
- [ ] Tests cho transitions hợp lệ/không hợp lệ, gia hạn conflict, race condition, expired/overdue, vehicle inactive, return odometer, role, audit rollback.
- [ ] Real development Supabase E2E: Customer → Rental → Reserve → Handover/Active → Extend → Return/Complete; tạo 2 request đồng thời tranh cùng xe; cross-tenant IDOR.
- [ ] Regression Fleet Core, Supabase RLS, SaaS Core và production preview boundaries.
- [ ] Chạy `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`; browser QA desktop/mobile và cleanup dữ liệu test thuộc quyền sở hữu.

## Acceptance Criteria

- [ ] Customer/Rental CRUD & lifecycle chạy với dữ liệu thật theo từng Business.
- [ ] Không thể giữ 2 reservations/active rentals overlapping trên cùng xe, kể cả request đồng thời.
- [ ] Vehicle effective availability chính xác, không ghi đè `vehicles.status` của Stage 3.
- [ ] `OVERDUE` hiển thị khi ACTIVE quá hạn, không phải persisted workflow status.
- [ ] Không truy cập hoặc ghi Customer/Rental của business khác; các quyền được enforce từ backend.
- [ ] Audit & API contracts cập nhật; các màn live không sử dụng mock GPS/Trip/Commercial.
- [ ] All tests pass trên development Supabase; không seed/migrate nhầm staging hoặc production.

## Deliverables

1. Migration + Drizzle mapping + domain rules/tests.
2. NestJS Customer/Rental/Availability API + Swagger/OpenAPI contracts.
3. Live Business Admin Customers/Rentals + Vehicle rental state integration.
4. Test evidence và browser screenshots.
5. Cập nhật `STAGE_OUTPUT.md` trong cùng commit, ghi rõ live/preview, checks và outstanding work.

## Execution Order

`Schema → Availability/Transition Rules → API & RBAC → Contracts → Live UI → E2E/QA → STAGE_OUTPUT.md`

**Next:** GPS PoC / Traccar & telemetry integration (riêng); Superadmin global backend là workstream độc lập.
