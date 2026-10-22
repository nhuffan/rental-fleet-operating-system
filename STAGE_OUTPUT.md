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
