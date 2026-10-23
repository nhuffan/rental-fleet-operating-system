# Stage 5 — GPS PoC & UI validation

Ngày cập nhật: **2026-10-23**. Nhánh `main`, baseline `e892474dcaf45cf67bbbb73cf427959f3a31fbce`. Kế hoạch: [Stage_5_GPS_PoC_and_UI_Refinement_Plan_Compact.md](stages/Stage_5_GPS_PoC_and_UI_Refinement_Plan_Compact.md).

**Hoàn tất phạm vi Stage 5 trong development với Traccar TEST feed.** Chưa xác minh thiết bị vật lý hoặc triển khai provider production.

## Phạm vi và mức độ xác minh

- **TEST FEED:** Traccar 6.16.0, official image được pin digest, nhận OsmAnd packet và forward JSON vào trusted webhook; dữ liệu qua adapter, database, API tenant và live UI. Tất cả vị trí lưu/hiển thị mang nhãn TEST. Không xác minh thiết bị GPS vật lý hoặc provider bên ngoài chạy bền vững.
- **LIVE:** `/app/fleet-map`, dashboard map/statistics và Vehicle Detail dùng location API thật. Trạng thái đăng ký/gắn thiết bị tách khỏi FRESH/STALE/OFFLINE/NO_DATA/UNASSIGNED. Không thay fixture thành dữ liệu GPS live.
- **PREVIEW:** Business/Platform design previews vẫn dùng synthetic fixtures có nhãn, chỉ trong development. Superadmin không có global production authorization/backend.
- Typography được điều chỉnh qua semantic tokens/component styles trên live pages và cả hai preview domains. Login dùng cùng hệ cam/xám/trắng, giữ `signInWithPassword`, pending/error, SSR session, reset business cookie và redirect `/app`.
- Web localhost được thống nhất **4000** theo yêu cầu người dùng; API vẫn **3001**. Thay đổi scripts, env examples, Docker/Compose, local Auth redirect và development guide được đưa cùng đợt triển khai.

Chi tiết contract, bảo mật, operation và giới hạn: [GPS PoC](gps-poc.md).

## Bằng chứng GPS

| Kiểm tra | Kết quả đã xác minh |
| --- | --- |
| Nguồn | Official Traccar 6.16.0 image, pin digest; local OsmAnd HTTP → Traccar JSON → `POST /api/v1/integrations/traccar/positions` |
| Canonical data | Timestamp/coordinates/device identity được validate; tốc độ Traccar knots chuyển ×1.852 sang km/h; source mode được server cố định `TEST` |
| Device/assignment | Resolve registry rồi historical assignment tại `recordedAt`, với composite tenant FK; event không hợp lệ/không resolve được bị từ chối |
| Duplicate và out-of-order | Duplicate lưu một lần; packet trễ không kéo current location lùi; timestamp bằng nhau giữ bản nhận thành công đầu tiên |
| Lặp lại feed | Chạy `gps:poc` hai lần với cùng UID thành công; semantic dedup không phụ thuộc upstream memory-store ID |
| SIGTERM cleanup | Runtime kết thúc với exit **143**; kết quả kiểm tra `containerRemoved: true`, `tempConfigRemoved: true` |
| Freshness | FRESH ≤120 giây, STALE >120…600 giây, OFFLINE >600 giây; NO_DATA/UNASSIGNED độc lập với registry |
| Retention | Giữ history 30 ngày theo `receivedAt`, trừ latest point của active assignment; CLI tenant-scoped, dry-run mặc định, tối đa 1.000 rows/lượt |
| Tenant boundary | User/Auth/RBAC + business-scoped reads; IDOR, invalid auth và Data API denial có real E2E |

Current-state equivalent dùng index và sắp `recordedAt DESC, receivedAt ASC, id ASC` theo assignment hiện tại; browser chỉ tải projection có phân trang. Poll 20 giây sau request, dừng khi tab ẩn và hủy request cũ khi unmount/filter/tenant đổi. Map dùng Leaflet/OpenStreetMap với attribution; tile lỗi vẫn dùng được danh sách/tọa độ.

## Kiểm thử tự động

| Kiểm tra | Kết quả tại thời điểm ghi báo cáo |
| --- | --- |
| `pnpm build` | Đạt API và production web với Turbopack mặc định; build lại sau chỉnh sửa cuối |
| `pnpm lint` | Đạt, không warning |
| `pnpm typecheck` | Đạt API + web |
| `pnpm test` | **110/110**, 11 files; gồm migration replay, adapter/freshness và idle-PG-error regression |
| `pnpm test:e2e` | **32/32**, 4 files trên development Supabase thật `eeryymswcufnebibigqf` |
| Production HTTP boundaries | **18/18** trên production artifact cuối: 6 preview 404 và 12 private routes redirect login |
| Migration/RLS | Development schema có **12 public application tables**, đều bật RLS; `gps_positions` revoke toàn bộ Data API privileges cho anon/authenticated |
| Git diff | `git diff --check` đạt; source, contracts, stage log và evidence được commit cùng nhau |

Trong QA phát hiện idle PostgreSQL disconnect có thể phát ra unhandled pool error, làm API dừng và có nguy cơ serialize client/connection details. `createPool()` hiện xử lý lỗi này, chỉ log event/type đã rút gọn; regression test xác nhận không throw và không log message/client/password. Không ghi lại credentials hoặc raw packets trong báo cáo.

Supabase advisory `RLS enabled without policy` của `gps_positions` là chủ ý: bảng này không mở Data API đọc/ghi. Warning [Auth leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) đã có trước và hiện không bật được trên Free plan. Covering index `gps_positions_assignment_identity` đã apply qua Supabase CLI và được xác minh; performance advisor cuối chỉ còn unused-index INFO, không còn unindexed-FK finding. Không seed/reset hoặc migrate staging/production.

## Browser QA và responsive

Đã kiểm tra DOM **40 tổ hợp**: 8 màn ×5 chiều rộng **1440/1280/1024/768/390px**. Gồm Login, Dashboard, Vehicles, Rental Detail, Fleet Map, Superadmin preview, Business preview và Vehicle Detail. Không có horizontal overflow toàn trang; table có vùng scroll riêng. Mẫu computed typography: body **15px**, navigation **14px**, table **14px**; không dùng transform/zoom để phóng toàn trang.

Login đã xác minh cả lỗi và thành công bằng Supabase thật. Sau khi đăng nhập thành công, `router.replace('/app')` chuyển trang; bỏ concurrent `router.refresh()` để tránh race điều hướng. Business cookie reset và SSR auth boundary được giữ. Các màn GPS hiển thị TEST, thời gian ghi nhận/nhận tại hệ thống và trạng thái không dữ liệu rõ ràng.

Đã xác minh search không có kết quả, lọc FRESH, marker → Vehicle Detail và đúng ACTIVE Rental, vị trí/timestamp TEST, cùng empty map sau khi dọn fixture. Bộ ảnh có **47 JPEG**; 36 ảnh bắt buộc trước/sau đều đúng chiều rộng và cao 1000px. Baseline được chụp từ bản UI `e892474` khôi phục trong thư mục tạm; API tương thích dùng development data. Rental QA chuyển RESERVED → ACTIVE để xác minh current-rental link, nên so sánh tập trung typography/layout chứ không phải pixel diff tuyệt đối. Cả hai preview domains và Vehicle Detail có thêm ảnh sau. [40 DOM measurements](stage-5-responsive-checks.json), [feed/signal/cleanup evidence](stage-5-poc-evidence.json).

| Màn / chiều rộng | Trước | Sau |
| --- | --- | --- |
| Login · 1440px | [Trước](stage-5-screenshots/before-login-1440.jpg) | [Sau](stage-5-screenshots/after-login-1440.jpg) |
| Login · 768px | [Trước](stage-5-screenshots/before-login-768.jpg) | [Sau](stage-5-screenshots/after-login-768.jpg) |
| Login · 390px | [Trước](stage-5-screenshots/before-login-390.jpg) | [Sau](stage-5-screenshots/after-login-390.jpg) |
| Dashboard · 1440px | [Trước](stage-5-screenshots/before-dashboard-1440.jpg) | [Sau](stage-5-screenshots/after-dashboard-1440.jpg) |
| Dashboard · 768px | [Trước](stage-5-screenshots/before-dashboard-768.jpg) | [Sau](stage-5-screenshots/after-dashboard-768.jpg) |
| Dashboard · 390px | [Trước](stage-5-screenshots/before-dashboard-390.jpg) | [Sau](stage-5-screenshots/after-dashboard-390.jpg) |
| Vehicles · 1440px | [Trước](stage-5-screenshots/before-vehicles-1440.jpg) | [Sau](stage-5-screenshots/after-vehicles-1440.jpg) |
| Vehicles · 768px | [Trước](stage-5-screenshots/before-vehicles-768.jpg) | [Sau](stage-5-screenshots/after-vehicles-768.jpg) |
| Vehicles · 390px | [Trước](stage-5-screenshots/before-vehicles-390.jpg) | [Sau](stage-5-screenshots/after-vehicles-390.jpg) |
| Rental Detail · 1440px | [Trước](stage-5-screenshots/before-rental-1440.jpg) | [Sau](stage-5-screenshots/after-rental-1440.jpg) |
| Rental Detail · 768px | [Trước](stage-5-screenshots/before-rental-768.jpg) | [Sau](stage-5-screenshots/after-rental-768.jpg) |
| Rental Detail · 390px | [Trước](stage-5-screenshots/before-rental-390.jpg) | [Sau](stage-5-screenshots/after-rental-390.jpg) |
| Fleet Map · 1440px | [Trước](stage-5-screenshots/before-fleet-map-1440.jpg) | [Sau](stage-5-screenshots/after-fleet-map-1440.jpg) |
| Fleet Map · 768px | [Trước](stage-5-screenshots/before-fleet-map-768.jpg) | [Sau](stage-5-screenshots/after-fleet-map-768.jpg) |
| Fleet Map · 390px | [Trước](stage-5-screenshots/before-fleet-map-390.jpg) | [Sau](stage-5-screenshots/after-fleet-map-390.jpg) |
| Superadmin preview · 1440px | [Trước](stage-5-screenshots/before-superadmin-1440.jpg) | [Sau](stage-5-screenshots/after-superadmin-1440.jpg) |
| Superadmin preview · 768px | [Trước](stage-5-screenshots/before-superadmin-768.jpg) | [Sau](stage-5-screenshots/after-superadmin-768.jpg) |
| Superadmin preview · 390px | [Trước](stage-5-screenshots/before-superadmin-390.jpg) | [Sau](stage-5-screenshots/after-superadmin-390.jpg) |

## Cleanup và trạng thái runtime

Dọn đúng IDs đã ghi của QA: **11 GPS positions +1 Rental +1 Assignment +1 Customer +1 Vehicle +1 GPS Device**, giữ **7 audit events**. Các E2E cũng dọn records do từng suite tạo và giữ audit. Không xóa theo wildcard hoặc tác động record có sẵn.

Baseline server 4100 và production QA server 4101 đã dừng; cổng 5055 trống, không còn container Traccar thử nghiệm. Temporary baseline checkout/config có token đã xóa; viewport được reset và tab QA đóng. Giữ Web **localhost:4000** cùng API **127.0.0.1:3001** theo yêu cầu runtime trước đó của người dùng; đã khởi động lại đúng API watcher sau khi sửa idle-pool error. Không dừng process của project khác.

Review độc lập tenant/ingestion/map/scripts đã xử lý mọi finding: map refit theo result scope đã tải thành công, script cleanup idempotent trên signals và verification không đếm packet từ lượt chạy trước. Tài liệu, source plan, OpenAPI/contracts, ảnh và stage log được lưu cùng implementation.

## Giới hạn

Không có physical tracker, durable external provider, production deploy, Trip/replay/geofence/alerts engine hoặc global Superadmin backend được xác minh. Traccar TEST feed là đường tích hợp đã kiểm chứng trong development. Production credential rotation/rate limiting, monitoring, automatic retention scheduling và map capacity còn là công việc productionization riêng. Kết quả được ghi trong [STAGE_OUTPUT.md](../STAGE_OUTPUT.md).
