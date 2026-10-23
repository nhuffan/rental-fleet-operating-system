# Stage 6 — Trip History & Codebase Refactoring

**Baseline:** `main` commit `85d4f2b4b1d7a75b8a24ec175ea61610b11ba989` (23/10/2026). Trước khi code, đọc source hiện tại và reconcile nếu `main` đã tiến thêm.

## Goal

Biến GPS positions hiện có thành **Trip History / Route Replay cơ bản** cho Vehicle và Rental; đồng thời làm sạch cấu trúc code, tài liệu và artifacts. **Một file Markdown duy nhất cho stage plan + implementation output: file này.**

## Scope

**In:** trip derivation/history, route query, Map UI replay, tenant authorization, refactor module boundaries và repository cleanup, tests.

**Out:** GPS vật lý/production onboarding, predictive analytics, geofence, alerts, toll/VETC, payment/accounting, Customer Portal, Superadmin production backend, staging/prod deployment.

## Implementation Tasks

### S6-01 — Codebase Audit & Cleanup Plan
- [x] Kiểm tra latest `main`, `AGENTS.md`, `apps/web/AGENTS.md`, `docs/development.md`, toàn bộ imports/routes/scripts/tests trước khi đổi cấu trúc.
- [x] Xác định các file trùng trách nhiệm hoặc lệch domain, nhất là `apps/web/src/features/fleet` vs `vehicles` / `gps` / `rentals`, `apps/api/src/gps` và scripts PoC; ghi danh sách `keep/move/delete` vào **Implementation Output** bên dưới, không tạo tài liệu audit khác.
- [x] Chuẩn hóa cấu trúc theo domain (`fleet/vehicles`, `rentals`, `telematics/trips`, `platform`), shared UI/components và data-access boundaries. Di chuyển theo từng bước, sửa tất cả imports; giữ URL/API/contracts, Auth, tenant switching và behavior đang chạy.
- [x] Không rewrite toàn project, không đưa code business vào shared UI; xóa dead code/fixtures không còn dùng sau khi xác minh import graph và preview boundaries.

### S6-02 — Trip Domain & Storage
- [x] Định nghĩa canonical Trip contract: `vehicleId`, optional `rentalId`, start/end, duration, distance, point count, source/freshness; phân biệt **derived/estimated** với đo đạc được xác nhận.
- [x] Tạo phương án tối thiểu từ `gps_positions` đang tồn tại: query grouped trips/on-demand hoặc materialized summary khi cần; **không tạo duplicate GPS history** vô ích.
- [x] Phân đoạn Trip bằng rule rõ ràng (ignition khi đáng tin; fallback time gap/movement threshold), xử lý packet delayed/out-of-order, gaps và duplicate. Không suy ra đường đi khi không đủ points.
- [x] Bảo toàn historical device assignment theo `recordedAt`; Trip/Rental association dựa trên time overlap và tenant/vehicle ownership. Phân biệt giao cắt thời gian với khẳng định toàn Trip thuộc Rental.
- [x] Chỉ thêm Supabase SQL migration + Drizzle mapping khi thực sự cần persisted trip summary; dùng migration history hiện có, indexes/retention phù hợp, RLS và tenant FK.

### S6-03 — NestJS Trip API
- [x] Tenant-scoped `GET /trips` và `GET /trips/:id` hoặc time-range route tương đương đã document; `GET /trips/:id/route` trả positions/simplified GeoJSON với paging/limits.
- [x] Filter theo Vehicle/Rental/date; pagination/sort; range cap và point cap chống request quá lớn. Trả timestamp UTC và UI format Asia/Ho_Chi_Minh.
- [x] Permission `trip.read` (OWNER/ADMIN/OPERATIONS theo policy đã thống nhất); backend verify membership/business, không lộ cross-tenant IDs/location.
- [x] Thiếu GPS data trả empty/partial state hợp lệ; TEST feed vẫn được gắn TEST, không giả lập điểm vị trí. Cập nhật OpenAPI/generated contracts nếu API thay đổi.

### S6-04 — Business Admin Trip UI (Live)
- [x] Chuyển `/app/trips` từ preview sang dữ liệu thật: Vehicle/Rental/date filters, trip list, duration/distance, recorded freshness và loading/empty/error states.
- [x] Trip detail/replay: Leaflet map, polyline, start/end marker, timeline scrub/step đơn giản; chỉ render points trong giới hạn, không polling lịch sử liên tục.
- [x] Liên kết Vehicle Detail và Rental Detail tới Trip list tương ứng; không hiển thị route/Trip ảo ở production.
- [x] Giữ design tokens hiện tại, typography đã cải thiện và login đồng bộ; kiểm tra 1440/768/390px bằng browser/DOM khi cần, **không chụp hoặc commit screenshot mặc định**.

### S6-05 — Repository Structure & Documentation Consolidation
- [x] Giữ **một output Markdown duy nhất cho stage này:** `docs/stages/Stage_6_Trip_History_and_Codebase_Refactor_Compact.md` (chính file này). Agent append kết quả, kiểm thử, giới hạn và commit SHA vào `## Implementation Output` dưới đây; **không viết thêm `STAGE_OUTPUT.md`, validation `.md`, architecture `.md`, recap `.md`, screenshot manifest `.md` hoặc report `.json`**.
- [x] Retire `STAGE_OUTPUT.md` ở root **sau khi** thay references (README/AGENTS/docs/scripts) sang stage file hiện hành và xác nhận lịch sử cũ vẫn truy xuất được qua Git history; không làm mất quy định/kiến thức vận hành quan trọng.
- [x] Dọn các `.md` rải rác trong `docs/`: `ui-*`, `stage-*-validation.md`, `gps-poc.md`, `fleet-core.md`, `rental-core.md` **chỉ khi** nội dung cần dùng đã được chuyển vào `docs/development.md` hoặc tài liệu canonical còn giữ, và không còn references/imports. Không xóa mù quáng tài liệu domain còn là source of truth.
- [x] Giữ Markdown thiết yếu: `README.md` (giới thiệu ngắn), `AGENTS.md` và `apps/web/AGENTS.md` (agent rules), `docs/development.md` (canonical runbook), **stage MD hiện hành**. Giữ `CLAUDE.md` nếu còn được công cụ sử dụng; loại bản stub/trùng khi xác minh an toàn. Các stage MD cũ có thể loại khỏi working tree **sau khi** bảo đảm lịch sử Git đủ để truy xuất và mọi references đã đổi.
- [x] Dọn **screenshot/QA evidence cũ** trong `docs/` nếu không còn được automation/CI hoặc tài liệu canonical sử dụng; không tạo screenshot mới. Nếu cần chứng cứ visual, chỉ tạo khi stage plan sau hoặc user yêu cầu rõ; không commit generated artifacts mặc định.
- [x] Không xóa `supabase/migrations`, contract generator/output cần cho build, tests, `infra/certs`, config, seeds có dùng, hoặc source thuộc runtime. Khi cleanup phải chạy search references và tests sau mỗi đợt xóa.
- [x] Từ Stage 6 trở đi, update instruction trong `AGENTS.md`/README để mọi agent dùng **stage file của đợt đang triển khai** làm log duy nhất và không auto-generate documentation/screenshot artifacts. Các file code/tests/migrations/contract cần thiết vẫn được tạo bình thường; hạn chế chỉ áp dụng **log/report/docs phát sinh**.

### S6-06 — Verification
- [x] Unit/integration: Trip segmentation, gaps, dedup, out-of-order, assignment history, partial routes, rental association, distance estimation, retention boundary.
- [x] Real development Supabase E2E: TEST feed → positions → Trip API → UI; cross-tenant IDOR, read permissions, range/point limits, no cross-tenant GPS leakage.
- [x] Regression SaaS Core/Fleet/Rental/GPS ingestion, preview production boundaries, responsive, Login, API ports (Web 4000 / API 9000 theo yêu cầu mới nhất của người dùng).
- [x] Chạy `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` khi development services được xác minh sẵn sàng. Chạy browser QA tương tác nếu có khả năng; **không screenshot mặc định**.
- [x] Không seed/migrate/reset staging hoặc production; cleanup chỉ data/test processes do agent sở hữu. Dừng server/Traccar tạm do agent khởi tạo, trừ dev servers người dùng yêu cầu giữ.
- [x] `git diff --check`; kiểm tra không còn links đến docs đã xóa, không phá imports/route/contracts, không leak secret; ghi kết quả ngay vào file này.

## Acceptance Criteria

- [x] Vehicle có GPS data thật từ **TEST feed** xem được Trip list và tuyến đường lịch sử trên UI; no-data xử lý đúng.
- [x] Trip generation/queries không làm sai current-location Stage 5; packet đến muộn và reassignment không làm sai lịch sử.
- [x] Tenant scope/RBAC/RLS đúng; không thể đọc vị trí/Trip thuộc Business khác.
- [x] UI Trip production dùng API, không dùng fixtures; các preview chưa có backend vẫn development-only.
- [x] Source structure được refactor theo domain, không phá API/routing/functional flows; tất cả checks pass.
- [x] Repo docs/artifacts gọn hơn, không còn tài liệu rời rạc không dùng; **không có screenshot/report mới**.
- [x] **Chỉ file stage MD này** chứa implementation output của stage, với pass/fail, remaining limitations và commit SHA.

## Execution Order

`Audit/import graph → safe structural refactor → Trip contract/domain → API → UI → cleanup docs/artifacts → regression/E2E → append Implementation Output in this file`

## Implementation Output

> **Agent ghi kết quả tại đây sau khi implement.** Chỉ ghi đã thực hiện và đã verify; không tự đánh dấu Pass khi chưa test. Ghi commit SHA, changed paths, commands/results, dev/live/test-feed boundaries, phần chưa làm. **Không tạo file báo cáo khác.**

**Status:** COMPLETE — implementation và toàn bộ verification đã PASS ngày 23/10/2026.

### 23/10/2026 — Phạm vi và port

- Triển khai trực tiếp trên `main` của repository `/Users/nhuffan/Documents/Projects/Car Rental Fleet Operation ` (tên thư mục có dấu cách cuối), baseline và `origin/main` đều là `85d4f2b4b1d7a75b8a24ec175ea61610b11ba989` trước đợt này.
- Theo yêu cầu mới nhất, Rental API đổi từ 3001 sang **9000**, Web giữ **4000**. Đã đồng bộ config mặc định, env examples, ignored local env, Docker expose/Compose/internal API và Traccar forwarder dùng `config.port`. Health API 9000 và Web 4000 đã kiểm tra; không chỉnh source hoặc dừng tiến trình Digital Twin.

### Keep / move / delete đã thực hiện

| Quyết định | Paths / lý do |
| --- | --- |
| Keep | `supabase/migrations`, Drizzle schema, tests/seeds, `infra/certs`, generated OpenAPI/contracts, runtime configs; không thêm migration vì Trip được tính on demand từ GPS positions hiện có. |
| Keep | README giới thiệu ngắn; root/Web AGENTS; `docs/development.md` giữ canonical runbook và policy; file Stage 6 này là output duy nhất. Hai `CLAUDE.md` shim vẫn được tooling sử dụng. |
| Move API | `src/fleet/*` → `src/fleet/vehicles/*`; `src/rental/*` → `src/rentals/*`; `src/gps/*` → `src/telematics/gps/*`; PoC/retention scripts → `scripts/telematics/*`. URLs/payloads cũ và package command names được giữ. |
| Move Web | `features/vehicles/*` → `features/fleet/vehicles/*`; `features/gps/*` → `features/telematics/gps/*`; synthetic Fleet/Core preview → `features/previews/business/*`. Rentals/platform giữ domain riêng. |
| Shared | Record picker chuyển sang `components/data-display`; query/page/date formatting và UTC+7 conversion sang `lib/query.ts`, `lib/date-time.ts`; không đưa nghiệp vụ tenant vào shared UI. |
| Delete | Retire root `STAGE_OUTPUT.md`; xóa 138 paths cũ trong docs sau consolidation/reference audit: 122 screenshots (9.241.671 bytes), 11 Markdown rời rạc, 3 stage plans cũ, 2 QA JSON. Có thể phục hồi lịch sử bằng `git show 85d4f2b:<path>`. Không có runtime dependency vào các artifacts đã xóa. |

### Trip API/domain và UI đã triển khai

- Thêm `apps/api/src/telematics/trips` và `trip.read` cho OWNER/ADMIN/OPERATIONS. Các route tenant-scoped `/api/v1/trips`, `/trips/:id`, `/trips/:id/route` dùng active profile/business/membership guards. Vehicle/Rental filter và opaque ID đều được kiểm tra tenant; ID không phải credential.
- Contract gồm Vehicle, historical assignment/device, optional Rental association, UTC start/end/duration, estimated distance, point count, source/freshness/partial reasons và query range. Chỉ gắn `TEST`, `DERIVED`, `ESTIMATED`; không claim GPS vật lý/odometer/actual driver.
- Default 24 giờ, range `[from,to)` tối đa 7 ngày và end không quá +5 phút; cap 10.000 candidate positions trước pagination, vượt cap trả 422 `TRIP_POINT_LIMIT`. List tối đa 100/trang; route tối đa 500 points/trang, có total/hasMore.
- Sort theo recorded time, chọn first-received khi duplicate timestamp; assignment change hoặc gap >10 phút chia đoạn; ignition tắt và speed <3 km/h đóng đoạn. Movement threshold 3 km/h hoặc usable edge ≥30m; stationary-only bỏ qua. Haversine ước tính khoảng cách; implied edge >250 km/h bị loại và ngắt polyline. Single moving fix vẫn partial, không có usable route.
- SQL và domain đều revalidate `recordedAt ∈ [assignedAt,unassignedAt)`; không dùng current assignment để suy ra history, loại future-skew fix nếu assignment đã kết thúc trước fix. Gaps/query/retention/ignition conflict/jump/unobserved start/end đều có lý do partial. Current-location query/ingestion Stage 5 giữ behavior.
- Rental association theo tenant/vehicle và scheduled window RESERVED/ACTIVE/COMPLETED: `CONTAINED` hoặc `OVERLAP`, `basis:SCHEDULED_WINDOW`; scalar rentalId chỉ khi đúng một association chứa toàn segment. Không claim lịch thuê là xác nhận sử dụng thực tế.
- `/app/trips` chuyển sang API thật, có picker Xe/Rental phân trang/tìm kiếm, date VN, sort/page, loading/empty/error/404 và hướng dẫn thu hẹp range khi vượt cap. Detail `/app/trips/[id]` có Leaflet polyline/start/end/cursor, scrub/step, route paging 500 points và không polling history. Không nối qua gap/jump hoặc qua các trang tuyến.
- Vehicle Detail và Rental Detail có liên kết tới filtered history; Rental dài lấy cửa sổ tối đa 7 ngày và Rental tương lai có fallback hợp lệ. Navigation dùng `trip.read`; contracts được regenerate. Preview fixtures nằm trong development-only module, production không render route ảo.

### Kiểm tra đã hoàn thành

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm build` | PASS API + Web production build |
| `pnpm openapi` | PASS, cập nhật `packages/contracts/openapi.json` và `src/openapi.d.ts` |
| `pnpm lint` / `pnpm typecheck` | PASS cả API/Web |
| `pnpm test` | PASS **126 tests / 14 files**, gồm migration replay/security/domain và Trip segmentation/dedup/out-of-order/gap/assignment/partial/overlap/estimate/retention |
| `pnpm test:e2e` | PASS **35 tests / 5 files** (155,65 giây), gồm 3 Trip E2E mới; chỉ development project `eeryymswcufnebibigqf`, không staging/production |
| Production release boundaries | PASS **21/21**: 7 preview/platform routes trả 404, 14 private routes redirect Login; chạy tạm `next start --port 4101 --hostname 127.0.0.1`, đã dừng |
| Browser interaction | PASS live Trip list/detail/map, timeline End/previous, searchable Vehicle picker, Vehicle/Rental → filtered history, range >7 ngày, missing Trip, Login invalid/valid và empty state sau cleanup |
| Responsive DOM | PASS **24 checks**: Trip detail/list, Vehicle detail, Rental detail, dashboard, fleet map, business preview, Login × 1440/768/390px; document scrollWidth bằng viewport, body 15px |
| Refactor/docs audit | PASS import graph, relative canonical links, deleted reference checks, preview import gates, `git diff --check`; ignored env/seed credentials không nằm trong Git |

### Real TEST pipeline và cleanup

- Development project đã ACTIVE_HEALTHY, TLS certificate/hostname verification vẫn bật. Không thay schema/RLS/retention policy, không thêm duplicate GPS history.
- Đã chạy moved command `pnpm --filter api gps:poc --uid=<owned TEST UID>`: official Traccar 6.16.0 pinned image → API **9000** → Supabase; kiểm tra 12 knots →22.224 km/h, duplicate idempotency và delayed fix không kéo lùi current location.
- Tạo route QA riêng bằng OsmAnd → Traccar decoder → authenticated forwarding → positions, gửi đảo thứ tự và retransmit. Database giữ đúng **11 unique TEST points**, UI suy ra **2 segments** (7/4 points, gap >10 phút, khoảng 0,94/0,47km, 6/3 phút). Partial reasons và Rental scheduled-window link được hiển thị đúng.
- Assignment của disposable QA fixture được lùi thời gian có kiểm soát để test các fix lịch sử; không chỉnh assignment của tenant data khác. Hai points của lần smoke PoC đã dọn trước khi gửi route QA.
- Đã cleanup chính xác 11 positions, 1 rental, 1 assignment, 1 customer, 1 vehicle, 1 device do QA sở hữu, giữ **7 audit events**. Browser xác nhận list rỗng sau cleanup; không tạo fake route khi không có data. Full E2E tự cleanup bằng exact owned IDs.
- Traccar containers/config tạm và production QA server đã dừng/xóa; không còn listener 4101/5055. Dev Web 4000/API 9000 giữ theo yêu cầu trước đó. Không tạo screenshot, report JSON hay Markdown output thứ hai.

- Final runtime check: API health **200** trên 9000 (PID 45483), Web Login **200** trên 4000 (PID 32161), CORS preflight từ Web origin **204**; 3001/4101/5055 không còn listener. Temporary production session 85693 đã kết thúc; Docker không còn container Traccar QA của đợt này.

### Giới hạn còn lại

- Chỉ TEST feed qua pipeline thật; chưa có thiết bị vật lý/provider durable hay staging/production deployment. Khoảng cách là đường thẳng giữa fix hợp lệ, không map matching/odometer. OSM tiles là best-effort; tile lỗi vẫn có tọa độ/timeline.
- Trips on demand, range-scoped IDs có thể thay đổi/404 sau late packet hoặc retention; cần mở lại danh sách. Detail và route là hai bounded reads nên concurrent history change có thể cần tải lại.
- Không có auto segmentation worker/materialized summaries, continuous replay animation/interpolation, alert/geofence, billing, Customer Portal hay live platform backend; đều ngoài scope.

### Commit

- Implementation commit: **`923c69e775843f4cb8ff399932388d05dd6ff58b`** — `feat: implement Stage 6 trip history and domain refactor` trên `main`. Commit này chứa code, tests, contracts, cleanup và toàn bộ Implementation Output; commit docs tiếp theo chỉ ghi SHA thực tế vào chính file này.
