# Stage 5 — GPS PoC & UI Refinement

**Baseline:** `main` commit `e892474dcaf45cf67bbbb73cf427959f3a31fbce` (22/10/2026). Đọc `STAGE_OUTPUT.md` và kiểm tra HEAD trước khi triển khai; nếu source đã đổi, điều chỉnh task theo code thực tế.

## Goal

Kết nối **ít nhất một GPS device/provider thật hoặc một Traccar test feed có khả năng kiểm chứng**, đưa vị trí gần nhất vào Business Admin; đồng thời chuẩn hóa **typography, visual density và Login page** để UI rõ, dễ đọc và đồng nhất với template cam/xám/trắng hiện tại.

## Scope

**In:** GPS ingestion PoC, canonical telemetry, current location, freshness/offline states, live Fleet Map mức cơ bản, liên kết Vehicle ↔ active Device Assignment, tests; UI typography & Login redesign trên các màn live và preview.

**Out:** Full Trip engine/replay/history analytics, geofence/alerts nâng cao, đa provider production, Toll/VETC, Superadmin global APIs, Customer Portal, billing, full accounting. Không đưa dữ liệu GPS mock thành live.

## Implementation Tasks

### S5-01 — GPS Integration Contract & PoC Gate
- [ ] Xác định **một** nguồn GPS: thiết bị thật → Traccar **hoặc** provider API; nếu chưa có thiết bị, dùng Traccar test feed được gắn nhãn `TEST` và ghi rõ mức độ xác minh.
- [ ] Định nghĩa `NormalizedTelemetry`: provider/device UID, `recordedAt`, `receivedAt`, latitude, longitude, speed (đơn vị rõ ràng), heading, ignition optional, source/event ID nếu có.
- [ ] Phân biệt device registered/assigned với **online/last seen**; định nghĩa ngưỡng fresh/stale/offline và xử lý dữ liệu out-of-order/duplicate.
- [ ] Giữ adapter boundary `GPS provider → normalized event → ingestion service`; secret/token không vào browser.

### S5-02 — Database & Ingestion Backend
- [ ] SQL migration Supabase + Drizzle mapping cho GPS positions/history tối thiểu và `vehicle_current_location` hoặc current-state equivalent; index theo device/vehicle và thời gian.
- [ ] Resolve GPS event qua **active/historical Device Assignment tại thời điểm recordedAt**, không mặc định `vehicle.gps_device_id`.
- [ ] Implement authenticated trusted ingestion path (webhook/poller/Traccar integration), validate timestamp/coordinates/device identity, idempotency/duplicate handling và structured errors.
- [ ] Update current state **chỉ khi bản tin mới hơn**, vẫn lưu history hợp lệ theo retention PoC; không ghi đè current location bằng delayed packet.
- [ ] Tenant scope ở API đọc và RLS; không expose raw telemetry hoặc provider credentials trực tiếp cho client.

### S5-03 — Live Location API & Business Admin
- [ ] `GET /vehicles/:id/location`, tenant-scoped `GET /fleet/locations` (hoặc paths đồng bộ API convention); chỉ trả data đủ dùng cho UI và `lastSeenAt`/freshness.
- [ ] Kết nối `/app/fleet-map` với **location API thật**; map dùng Mapbox GL JS hoặc SDK đã quyết định, có cấu hình token an toàn, attribution và loading/error/empty states.
- [ ] Marker → vehicle detail/current rental; tìm kiếm, lọc trạng thái GPS và điều hướng; hiển thị location timestamp rõ ràng. Không hiển thị dữ liệu GPS đã gán như đang online nếu chưa nhận bản tin.
- [ ] Nếu realtime chưa cần hoặc chưa chắc, dùng polling có giới hạn trước; WebSocket chỉ thêm khi có yêu cầu và đo được lợi ích. Không bắt browser tải toàn bộ history.
- [ ] Live dashboard chỉ hiển thị map/GPS statistics khi có dữ liệu thật, với thông báo `Chưa có dữ liệu vị trí` thay vì fixtures.

### S5-04 — UI Typography & Visual Density (P0)
- [ ] Audit font-size/weight/line-height trên `styles/tokens.css`, `base.css`, `operational.css`, `fleet-core.css`, `rental-core.css`, các shared components và hai preview domains.
- [ ] Nâng typography theo scale đề xuất: body **15px / 1.5–1.6**, navigation **14px / 500–600**, forms/tables **13–14px / 500**, page title **26–30px / 700**, section title **16–18px / 650–700**, helper text **12–13px**, badge **11–12px / 600**. Không để nội dung quan trọng 8–10px.
- [ ] Tăng readability cho `.nav-link`, `.nav-label`, `.business-context`, `.topbar`, `.panel-heading`, `.data-table`, `.status-badge`, `.search-input`, `.filter-select`, `.map-popover`, dashboard statistics/schedule/queue. Ưu tiên sửa qua semantic tokens và component styles, không override rải rác.
- [ ] Cân lại spacing, card padding và table row height sau khi tăng chữ; không chỉ scale toàn trang bằng CSS transform/zoom. Tối ưu content hierarchy, contrast, text truncation và icon/text alignment.
- [ ] Đảm bảo desktop 1440/1280/1024, tablet 768 và mobile 390 không bị horizontal overflow; table có scroll riêng, map/sidebar không che nội dung, nút bấm/touch targets đủ dùng.

### S5-05 — Login Page Redesign (P0)
- [ ] Refactor `apps/web/src/app/login/page.tsx` và style `.login*` để dùng cùng design tokens, logo/brand, Button, Field, typography, border/radius/shadow như Business Admin & Superadmin.
- [ ] Login desktop có panel thương hiệu vừa phải và form card rõ ràng; mobile ưu tiên form, bỏ hero quá lớn. Không tái tạo kiểu marketing page không đồng bộ template.
- [ ] Giữ nguyên Supabase `signInWithPassword`, `pending/error`, logout/redirect `/app`, business cookie reset và SSR auth flow; không tạo flow email invite/OTP mới.
- [ ] Form label/placeholder, error, focus, submit disabled/loading có contrast tốt; hỗ trợ keyboard/autofill; kiểm tra trạng thái lỗi và narrow viewport.

### S5-06 — Verification & Documentation
- [ ] Migration replay; unit/integration cho validation, duplicate/out-of-order telemetry, assignment history, offline freshness, tenant isolation và API permissions.
- [ ] E2E trên **development Supabase**: GPS sample/real packet → adapter → storage/current state → tenant API → live UI; cross-tenant IDOR và auth errors.
- [ ] `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (khi env dev có sẵn) và production preview-boundary regression.
- [ ] Visual QA **before/after**: Login + Dashboard + Vehicles + Rental Detail + Fleet Map + Superadmin preview tại 1440/768/390; chú ý font weight/size, line wrapping, contrast, alignment.
- [ ] Không seed/migrate staging/production; cleanup test records có ownership; cập nhật `STAGE_OUTPUT.md` trong cùng commit, tách rõ `REAL DEVICE`, `TEST FEED`, `LIVE`, `PREVIEW` và giới hạn còn lại.

## Acceptance Criteria

- [ ] Có **một GPS integration path** chạy end-to-end; bằng chứng ghi rõ thiết bị thật hay test feed.
- [ ] Current location chỉ nhận event hợp lệ/mới nhất; mất kết nối hiển thị stale/offline đúng; giữ được GPS history tối thiểu.
- [ ] Business A không đọc location của Business B; map production không hiển thị fixture.
- [ ] Business Dashboard/Fleet Map hiển thị vị trí + thời gian cập nhật chính xác hoặc empty state trung thực.
- [ ] Font/weight toàn bộ UI cân đối, thông tin chính không còn quá nhỏ/mỏng; typography scale nhất quán ở hai domain và các live pages.
- [ ] Login cùng visual language với Admin UI, responsive, không regression auth/session/redirect.
- [ ] Tests/build và screenshot comparison đạt; `STAGE_OUTPUT.md` phản ánh đúng mức độ hoàn thành.

## Execution Order

`PoC source decision → Canonical contract/schema → Ingestion/API → Live Map → Typography & Login (có thể chạy song song với GPS API) → E2E/Visual QA → STAGE_OUTPUT.md`

**Next:** Trip History & GPS productionization; **Superadmin global authorization** là workstream tách biệt.
