# Stage Output

Nhật ký kết quả triển khai, đặt cạnh `README.md`. Mỗi stage được nhận diện bằng **đúng tên file Markdown đầu vào**. Sau mỗi đợt implement, thêm một mục có ngày cập nhật bên dưới stage tương ứng; giữ nguyên lịch sử các đợt trước.

Mỗi mục cần ghi: file nguồn và đường dẫn trong repo, phạm vi đã làm, trạng thái live/preview, kiểm tra đã chạy và kết quả, phần còn lại hoặc giới hạn. Chỉ ghi kết quả đã xác minh; không đánh dấu hoàn tất toàn bộ stage khi vẫn còn tiêu chí chưa đạt. Cập nhật file này trong cùng commit với thay đổi triển khai stage.

## `Rental_Fleet_OS_UI_Reimplementation_Plan_Visual_Reference_v2.md`

### 22/10/2026 — Triển khai UI Superadmin & Business Admin

- **File stage đầu vào:** `Rental_Fleet_OS_UI_Reimplementation_Plan_Visual_Reference_v2.md`.
- **Bản lưu trong repo:** [docs/ui-reimplementation-plan.md](docs/ui-reimplementation-plan.md).
- **Nhánh triển khai:** `main` của repo Car Rental hiện tại.
- **Commit gốc:** `59cc975669b3c2716dc0d6cb4b4e56e847022804`.
- **Trạng thái:** Đã triển khai SaaS Core UI và các operational/platform design preview. Kế hoạch tổng thể còn chờ backend của các domain mới, visual signoff và controlled rollout.

#### Đã implement

| Phần của kế hoạch                        | Kết quả                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 — Baseline & inventory           | Ghi nhận mã nguồn/API/route hiện tại, ảnh baseline desktop/tablet, screen inventory và ranh giới live/preview.                                                                                                                                                                         |
| Phase 1 — Design system & shells         | Tokens cam/xám/trắng, CSS theo component, Button/Badge/Panel/DataTable/Search/Pagination/Skeleton/Drawer/feedback; shell Business và Platform dùng chung ngôn ngữ thiết kế, active navigation, breadcrumb, profile/role, tenant picker và mobile navigation.                           |
| Phase 2 — Business SaaS Core             | Tách `resource-panel.tsx` và route dispatcher thành feature/route riêng cho Business Profile, Members, Branches, Settings; thêm Tenant Audit bằng API hiện có. Có form validation, drawer, search/filter, pagination, trạng thái lưu/lỗi và giao diện theo permission.                 |
| Phase 3 — Superadmin preview             | Overview với Tenant Health, 2×2 metrics, Platform Activity và Requires Attention; Businesses/detail tabs, Users, Features, Integrations/GPS, Audit và Settings bằng fixtures có nhãn.                                                                                                  |
| Phase 4 — Business Fleet preview         | Dashboard Map + Stats + Fleet Schedule + Active Rental Queue; Vehicles, Rentals, Customers, Fleet Map, Trips và Commercial. Có marker → xe → hợp đồng, segment lịch → hợp đồng, Ngày/Tuần, queue tabs, GPS filters, mobile map/list, rental creation walkthrough với bước ghi bị khóa. |
| Phase 5 — Kiểm tra trong phạm vi hiện có | Build/lint/typecheck/tests và browser QA với Auth/API fixture cục bộ; kiểm tra responsive, keyboard, tenant switching, các role và production preview boundaries. Các hạng mục cần môi trường thật hoặc product signoff vẫn đang chờ.                                                  |

#### Phần live và ranh giới bảo mật

- `/app` hiển thị dữ liệu SaaS Core thật từ `/me`, `/branches`, `/memberships` theo permission; không đưa KPI đội xe giả vào production.
- `/app/business`, `/app/users`, `/app/branches`, `/app/settings`, `/app/audit` kết nối API hiện có. Giữ URL, payload, Supabase SSR Auth, tenant isolation và backend RBAC.
- Chuyển doanh nghiệp tải lại document để xóa state form/list của tenant trước. OPERATIONS chỉ xem; ADMIN không có nút sửa membership OWNER/ADMIN. Lỗi `LAST_OWNER` và `USER_NOT_FOUND` có thông báo rõ.
- `/dev-preview/business`, `/dev-preview/platform` chỉ có trong development. `/superadmin` chỉ chuyển tới bản thiết kế trong development; production trả 404, không cấp quyền global cho tenant OWNER.
- Dữ liệu Fleet/GPS/Rental/Platform đều là fixtures tổng hợp, có nhãn minh họa và mốc thời gian/UTC+7. Các thao tác ghi chưa có API bị khóa, không thông báo thành công giả.
- Không thay đổi backend API, migrations, contracts, package manifests, lockfile hoặc các file môi trường thật.

#### Kết quả xác minh

| Kiểm tra                                | Kết quả                                                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build` tại checkout `main`        | Đạt với Turbopack mặc định, gồm build API và web.                                                                                                                       |
| `pnpm lint`                             | Đạt, không có warning.                                                                                                                                                  |
| `pnpm typecheck`                        | Đạt cho API và web.                                                                                                                                                     |
| `pnpm test`                             | Đạt: 2 file, 3 test hiện có.                                                                                                                                            |
| Production HTTP regression              | Đạt: 9/9 test tại bản implementation đã kiểm tra; preview production 404 và tenant routes chưa đăng nhập chuyển tới login.                                              |
| Browser QA bằng Auth/API fixture cục bộ | Đạt cho login/logout, save profile/settings, tạo chi nhánh, tenant switch, role controls, lỗi Owner/User ID và các click path của preview. Không ghi vào database thật. |
| Responsive                              | Hai dashboard được kiểm tra ở 1440/1280/1024/768/390px, không tràn ngang toàn trang.                                                                                    |
| `git diff --check`                      | Đạt.                                                                                                                                                                    |

Lần build đầu ở checkout hiện tại phát hiện route types cũ trong `.next/dev/types` tham chiếu `[section]` đã được thay thế. Đã chuyển cache sinh tự động này sang backup tạm và build/typecheck lại thành công; không sửa source/config để bỏ qua lỗi.

#### Còn lại / chưa implement

- Global platform principal/RBAC và các API quản trị Superadmin thật.
- Fleet, Rental, Customer, Telematics/Trip, Deposit/Toll/Revenue APIs; GPS/map SDK thật và backend kiểm tra trùng lịch.
- `pnpm test:e2e` với development Supabase thật chưa chạy; không seed staging/production.
- Chưa đối chiếu trực tiếp ảnh CarRent gốc vì ảnh không được đính kèm cùng yêu cầu implement; còn chờ visual signoff, accessibility audit đầy đủ và controlled rollout/deploy.

#### Tài liệu và bằng chứng

- [Screen inventory](docs/ui-screen-inventory.md)
- [Design tokens & components](docs/ui-design-tokens.md)
- [Báo cáo validation và ảnh trước/sau](docs/ui-validation-report.md)
- [Backend readiness epics](docs/ui-backend-readiness.md)
- [Ảnh dashboard Business](docs/ui-screenshots/after-business-dashboard-1440.png)
- [Ảnh dashboard Platform](docs/ui-screenshots/after-preview-platform-1440.png)


## `Stage_3_Fleet_Core_Implementation_Plan_Compact.md`

### 22/10/2026 — Fleet Core live trên development Supabase

- **File stage đầu vào:** `Stage_3_Fleet_Core_Implementation_Plan_Compact.md`.
- **Bản lưu trong repo:** [docs/stages/Stage_3_Fleet_Core_Implementation_Plan_Compact.md](docs/stages/Stage_3_Fleet_Core_Implementation_Plan_Compact.md).
- **Nhánh triển khai:** `main` tại project Car Rental trong `Documents/Projects`.
- **Commit gốc:** `ead0e8e6ccaa5fbf16b6c0126a9b78eebfd9d09c`.
- **Trạng thái:** Đạt các acceptance criteria của Stage 3 trong phạm vi Fleet Core, đã xác minh bằng development Supabase thật. Chưa triển khai/deploy staging hoặc production.

#### Đã implement

| Hạng mục | Kết quả |
| --- | --- |
| S3-01 — Schema & migration | Thêm `vehicles`, `gps_devices`, `device_assignments`, Drizzle mapping, tenant foreign keys, RLS và indexes/constraints. Migration `20261022151714_fleet_core.sql` được tạo và apply qua Supabase CLI; replay DB sạch đã kiểm tra. |
| S3-02 — Domain rules | Vehicle tách khỏi GPS registry và assignment; trạng thái `ACTIVE`/`INACTIVE`. Biển số chuẩn hóa viết hoa/bỏ khoảng trắng/dấu chấm/gạch nối, duy nhất trong Business. Provider chuẩn hóa chữ thường; `(provider, deviceUid)` duy nhất toàn hệ thống, ownership và identity bất biến sau tạo. Dùng disable thay hard-delete; phải tháo thiết bị trước khi disable xe/thiết bị đang gắn. |
| S3-03 — API & security | Vehicles list/detail/create/update; GPS list/create/update; assignment list/create/end. Tenant scope, RBAC, validation/error codes, search/filter/sort/pagination; khóa Business và kiểm tra lại quyền trong transaction cùng audit. Hai unique indexes chống gắn đồng thời trên cùng xe hoặc thiết bị; thời gian lấy từ DB, history không bị ghi đè. Swagger và TypeScript contracts đã tái sinh. |
| S3-04 — Business Admin UI | `/app/vehicles`, `/app/vehicles/devices`, `/app/vehicles/[id]` dùng API thật trong production path. Có list/filter/pagination, profile/branch/lifecycle, GPS hiện gắn, lịch sử, create/edit/assign/end drawers, permission controls và thông báo kết quả. Có loading/empty/error/retry/404; giữ design system và tenant shell. |
| S3-05 — Verification | Unit/integration, real Supabase E2E, production boundary checks, browser QA và review độc lập đã đạt. Dữ liệu QA được dọn đúng các bản ghi do bài test tạo; audit được giữ lại. |

#### Phần live và ranh giới

- OWNER/ADMIN quản lý Vehicle/GPS/Assignment; OPERATIONS chỉ đọc. Backend kiểm tra quyền độc lập với UI.
- Branch/Vehicle/Device/Assignment luôn được kiểm tra cùng Business. Cross-tenant ID/API request bị từ chối; RLS không cho Data API ghi trực tiếp.
- Mỗi xe và mỗi thiết bị chỉ có tối đa một active assignment; kết thúc và gắn lại tạo lịch sử riêng, không mất liên kết cũ.
- Live Vehicles không còn dùng fixtures, không hiển thị fake telemetry, GPS online, bản đồ live hoặc trạng thái Rental. Registry/assignment chưa đồng nghĩa có kết nối GPS.
- Các domain vận hành còn lại giữ ranh giới preview development; Superadmin chưa có global production backend.

#### Kết quả xác minh

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm build` | Đạt API và production web với Turbopack mặc định; build lại bản source cuối. |
| `pnpm lint` | Đạt, không warning. |
| `pnpm typecheck` | Đạt cả API và web. |
| `pnpm test` | **38/38**, 5 file; gồm migration replay/RLS, tenant FK/uniqueness/temporal constraints, domain rules, authorization recheck và atomic audit rollback. |
| `pnpm test:e2e` | **19/19**, 2 file trên development Supabase thật; gồm 7 Fleet scenarios và SaaS Core regression, IDOR, roles, concurrent assignment, history/audit, Data API RLS/write denial. |
| Production HTTP regression | **12/12**: preview trả 404, private SaaS/Fleet routes chuyển login khi chưa đăng nhập. |
| Browser QA thật | Tạo/sửa xe, chuẩn hóa plate/provider, đăng ký hai thiết bị, assign/end/reassign/history, Operations chỉ đọc, loading/error/retry và 404 đều đạt. |
| Responsive | Hồ sơ/lịch sử xe ở 1440/768/390px không tràn ngang toàn trang. |
| Development migration | Đã apply duy nhất migration mới vào `eeryymswcufnebibigqf` sau khi người dùng Resume; xác nhận đủ 9 bảng application bật RLS. |
| Cleanup | Dọn 1 xe + 2 thiết bị + 2 assignment QA; giữ nguyên 7 audit events. Tất cả server tạm đã dừng và xác minh không còn listener. |

Supabase ban đầu paused, sau Resume có lỗi routing pooler tạm thời rồi kết nối TLS/dry-run/migrate thành công. Lượt E2E đầu có một scenario nhiều request vượt timeout mặc định 5 giây; tăng timeout E2E lên 30 giây và chạy lại toàn bộ đạt 19/19, không thay assertion. Browser gặp một lần tải lỗi và nút Thử lại phục hồi dữ liệu đúng. Không sửa real env files, không seed/reset database và không đụng staging/production.

#### Còn lại / ngoài Stage 3

- Rental/Customer Core, booking availability và các trạng thái thuê xe.
- GPS ingestion/Traccar, telemetry/location/online/map, Trips và Commercial.
- Global Superadmin APIs, product visual signoff và triển khai staging/production.

#### Tài liệu và bằng chứng

- [Fleet Core architecture, policy và API](docs/fleet-core.md)
- [Báo cáo kiểm thử Stage 3](docs/stage-3-fleet-core-validation.md)
- [Development guide](docs/development.md)
- [Ảnh hồ sơ và lịch sử thiết bị](docs/stage-3-screenshots/vehicle-history-1440.png)
- [Ảnh mobile](docs/stage-3-screenshots/vehicle-history-390.png)


## `Stage_4_Rental_Core_Implementation_Plan_Compact.md`

### 22–23/10/2026 — Customer & Rental Core

- **File stage đầu vào:** `Stage_4_Rental_Core_Implementation_Plan_Compact.md`.
- **Bản lưu trong repo:** [docs/stages/Stage_4_Rental_Core_Implementation_Plan_Compact.md](docs/stages/Stage_4_Rental_Core_Implementation_Plan_Compact.md).
- **Nhánh triển khai:** `main` tại project hiện tại trong `Documents/Projects`.
- **Commit gốc:** `4b8baa2e4e7a9b1d8242f65f21dfb7926b44ca94`, đúng baseline trong file stage.
- **Trạng thái:** Đạt acceptance criteria Stage 4 trong phạm vi Customer/Rental Core, đã xác minh bằng Supabase thật và browser desktop/mobile; chưa deploy staging/production.

#### Đã implement

| Hạng mục | Kết quả |
| --- | --- |
| S4-01 — Schema & migration | Thêm `customers`, `rentals`, Drizzle mapping, composite tenant FKs, RLS và indexes/constraints. PostgreSQL GiST exclusion chống overlap cho RESERVED/ACTIVE trên khoảng `[startAt,endAt)`; partial unique index giữ tối đa một ACTIVE rental trên xe. Migration CLI `20261022163648_rental_core.sql` đã apply đúng development Supabase. |
| S4-02 — Domain | DRAFT → RESERVED → ACTIVE → COMPLETED; DRAFT/RESERVED → CANCELLED. Handover/Return ghi timestamps và odometer, return không nhỏ hơn handover. OVERDUE là derived condition; không ghi RENTED/AVAILABLE vào `vehicles.status`. Reserve kiểm tra resource ACTIVE; Reserve/Extend kiểm tra lịch trùng. Xe overdue chưa trả tiếp tục chặn đặt mới. |
| S4-03 — API & security | Customer/Rental list/detail/create/update, reserve/handover/extend/return/cancel, date-based vehicle availability và current/next rental state. OWNER/ADMIN manage, OPERATIONS chỉ đọc. Mọi write khóa Business, recheck quyền và ghi audit nguyên tử; tenant predicates, validation, pagination/filter/search và stable errors. OpenAPI/contracts đã tái sinh. |
| S4-04 — Live UI | Customers/Rentals production routes dùng API thật; list/detail/create/edit, reservation wizard chọn xe theo lịch, lifecycle actions/timeline. Draft có thể đổi xe/khách/ngày. Vehicle Detail có current/next rental và derived state; dashboard schedule/active queue/overdue tabs dùng dữ liệu thật, phân trang riêng. Loading/empty/error/retry/404 và action theo permission. |
| S4-05 — Automated verification | Migration replay, DTO/domain/service/RBAC/audit tests và real Supabase E2E/SaaS/Fleet regression đã đạt; production boundary checks đã đạt. Browser QA đã đạt sau khi người dùng bật lại công cụ browser. |

#### Policy và ranh giới live/preview

- Customer cần tên và ít nhất phone/email; liên hệ có thể trùng để hỗ trợ người dùng chung số/email. Chuẩn hóa trim/email lowercase; disable thay hard-delete. Customer/Vehicle đang có RESERVED/ACTIVE rental không được disable.
- Draft chưa giữ xe. Reserve/Extend luôn recheck dưới transaction lock; DB exclusion giữ invariant khi có request đồng thời. Hai khoảng liền nhau được phép dùng chung endpoint. Handover chỉ trong khoảng thuê và không khi xe còn hợp đồng ACTIVE khác.
- DRAFT PATCH được đổi customer/vehicle/date; RESERVED/ACTIVE chỉ sửa tiền/cọc/notes, gia hạn qua action riêng; COMPLETED/CANCELLED read-only. Request lặp hoặc state không hợp lệ bị từ chối.
- Tiền thuê/cọc không âm, tối đa hai chữ số thập phân; cọc chỉ có số tiền yêu cầu và cờ đã nhận. Không có payment/refund ledger hoặc đối soát.
- Các form/time labels dùng giờ Việt Nam, truyền ISO có UTC offset và lưu `timestamptz`; action/overdue dựa trên DB clock. Audit metadata chỉ có requestId/field names, không lưu contact/notes/body.
- `/app/customers`, `/app/rentals`, dashboard schedule/queue và Vehicle rental integration live; không đưa fixture GPS/map/Trip/Commercial hoặc Superadmin vào production.

#### Kết quả xác minh

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm build` | Đạt API và production web với Turbopack mặc định. |
| `pnpm lint` | Đạt, không warning; web lint chạy lại sau các chỉnh sửa cuối. |
| `pnpm typecheck` | Đạt cả API và web. |
| `pnpm test` | **94/94**, 9 file, gồm 15 DB cases mới và 41 DTO/domain/service cases mới. |
| `pnpm test:e2e` | **27/27**, 3 file trên Supabase development thật; gồm 8 Customer/Rental scenarios và regression SaaS/Fleet. |
| Production HTTP boundaries | **17/17**: design previews production 404, private Customer/Rental/create/detail và SaaS/Fleet routes chuyển login khi chưa đăng nhập. |
| Security/domain review | Review độc lập schema/API/UI không còn finding quan trọng; xác nhận tenant scope, race/rollback, UTC, permission, picker pagination và fixture boundaries. |
| Supabase | Project `eeryymswcufnebibigqf`; 11 bảng application bật RLS. Không phát sinh security advisory mới; warning Auth leaked-password protection đã có từ trước. |
| Browser QA | Đạt Customer create/edit/history, wizard, reserve/handover/extend/return, draft edit/reserve/cancel, Vehicle current/next rental, dashboard schedule/queue, Operations chỉ đọc và direct-create denial, loading/empty/404. |
| Responsive | Rental profile 1440/768/390px không tràn ngang toàn trang; thao tác nhận trả hoàn tất trên mobile. |
| Cleanup | Dọn đúng 1 Vehicle + 1 Customer + 2 Rental QA, giữ nguyên 13 audit events. Server tạm đã dừng, xác minh PID/cổng; khôi phục build mặc định sau QA. |

#### Còn lại / ngoài scope

- GPS ingestion/Traccar/realtime map/Trip, Toll/VETC, payment gateway, full accounting/P&L, advanced pricing, customer portal và global Superadmin API thuộc stage/workstream khác.
- Chưa deploy staging/production; không seed/reset hoặc migrate nhầm project.

#### Tài liệu

- [Rental Core architecture, policy và API](docs/rental-core.md)
- [Báo cáo kiểm thử Stage 4](docs/stage-4-rental-core-validation.md)
- [Ảnh Rental live desktop](docs/stage-4-screenshots/rental-active-1440.png)
- [Ảnh Rental live mobile](docs/stage-4-screenshots/rental-active-390.png)
- [Development guide](docs/development.md)
