# UI Reimplementation Plan — Superadmin & Business Admin

> Tài liệu này giữ nội dung kế hoạch tham chiếu. Kết quả triển khai và trạng thái từng đợt được ghi tại [STAGE_OUTPUT.md](../STAGE_OUTPUT.md); các checkbox trong kế hoạch không thay thế nhật ký kết quả.

**Project:** Rental Fleet Operating System\
**Repository:** https://github.com/nhuffan/rental-fleet-operating-system\
**Source reviewed:** `main` (22/10/2026)\
**Scope:** Reimplement Web UI cho 2 domain: **Superadmin** và **Business Admin**. **End User / Customer Portal ngoài phạm vi.**\
**Status:** Kế hoạch; chưa sửa code hay database.

---

## 1. Goal & Architectural Decision

Thiết kế lại giao diện theo hướng **modern B2B SaaS / operational dashboard**, nhưng **không rewrite toàn bộ project**. Giữ nguyên Next.js, NestJS, Supabase Auth, PostgreSQL, OpenAPI contracts, tenant isolation và business rules hiện có.

**Target:** 1 monorepo, 1 shared design system, 2 UI domains với 2 layout riêng:

- **Superadmin:** SaaS platform operator, xem và quản trị nhiều tenant, features, support, integration health, platform audit.
- **Business Admin:** chủ doanh nghiệp/nhân viên vận hành đội xe, quản lý business settings, users, branches và về sau vehicle, rental, GPS, toll/deposit/revenue.

Không tạo branch-per-business, không tạo 2 codebase riêng. Có thể deploy chung frontend, nhưng authorization của hai domain phải tách rõ.

### Release boundary

- **Live UI:** chỉ kết nối các API đang tồn tại.
- **Design preview:** UI dùng mock/fixture có gắn nhãn, không giả vờ dữ liệu production và không giả mạo hành động ghi thành công.
- **Superadmin production:** chưa được bật cho tới khi có global backend RBAC/API; tenant `OWNER` **không phải** Superadmin.

---

## 2. Repository Audit — Actual Current State

Dựa trên source `main` của repo:

| Area             | Hiện trạng xác minh                                                                   | Hướng xử lý                                                            |
| ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Frontend         | `apps/web`, Next.js 16.3.5, React 19.2.8, Tailwind v4                                 | Giữ stack                                                              |
| API              | `apps/api`, NestJS, Drizzle, Supabase Auth                                            | Không rewrite cho UI                                                   |
| Web shell        | `apps/web/src/app/app/layout.tsx`                                                     | Refactor thành `BusinessShell`; tạo thêm `PlatformShell`               |
| Dashboard        | `src/app/app/page.tsx` chỉ có Business, Branch và note future functions               | Redesign nhưng không bịa số liệu fleet                                 |
| Page routing     | `src/app/app/[section]/page.tsx` hỗ trợ `business/users/branches/settings`            | Di chuyển từng trang sang feature-specific routes, giữ URL tương thích |
| CRUD UI          | `src/app/app/resource-panel.tsx` gộp form/list/edit/network logic                     | Tách feature/components/hooks                                          |
| Tenant switching | `src/app/app/shell-controls.tsx`, cookie `current-business`                           | Giữ behavior; backend xác minh membership                              |
| API client       | `src/lib/api.ts`, `GET /api/v1/me`                                                    | Giữ SSR auth/session; chuẩn hoá typed API layer                        |
| Styling          | `src/app/globals.css` dùng CSS global cho `aside`, `header`, `nav`, `button`, `table` | Thay bằng design tokens + scoped components                            |
| UI dependency    | Chưa thấy shadcn/ui, Radix, TanStack Table được cài trong `apps/web/package.json`     | Thêm có chọn lọc                                                       |
| Role             | `OWNER/ADMIN/OPERATIONS` (tenant roles)                                               | Chưa có global `SUPERADMIN`                                            |
| API hiện có      | `/me`, `/businesses/current`, `/memberships`, `/branches`, `/settings`, `/audit-logs` | Dùng API thật                                                          |
| API chưa có      | Platform-wide businesses/users/features/GPS; Vehicles/Rentals/Trips/Commercial        | Chỉ prototype hoặc separate backend roadmap                            |
| Repo conventions | `AGENTS.md`, `apps/web/AGENTS.md`, `docs/development.md`                              | Bắt buộc đọc trước mọi thay đổi                                        |

**UX gaps nhận thấy từ code:** bố cục thiên về template/generic CRUD; dashboard chưa phản ánh vận hành; CSS global dễ conflict; `ResourcePanel` quá tải trách nhiệm; chưa có shell riêng cho SaaS operator; chưa có Fleet Map UX.

**Giới hạn review:** Đã kiểm tra source, chưa chạy app hoặc xem staging screenshot. Cần visual baseline ở Phase 0.

---

## 3. Design Direction — Shared Design System

### 3.1 Visual principles

- Clean, modern, professional, desktop-first; ưu tiên khả năng scan table và action nhanh.
- Neutral light-gray canvas, white surfaces, **orange/coral accent** giống visual reference được duyệt (không dùng lime/gradient); các màu semantic success/warning/danger vẫn độc lập với brand.
- Typography hỗ trợ tiếng Việt tốt; body 14px, table 13–14px, headings có hierarchy.
- Medium/compact information density; padding nhất quán, cards vừa phải, ít charts trang trí.
- Semantic color + text/icon cho `AVAILABLE`, `RESERVED`, `RENTED`, `OVERDUE`, `MAINTENANCE`, `INACTIVE`, `GPS OFFLINE`.
- Focus/hover/disabled/loading/error/success rõ ràng; WCAG-oriented contrast; keyboard accessibility.
- Layout desktop 1440px, 1280px, 1024px, tablet; mobile fallback với navigation đóng/mở.
- Map phải có full-height canvas và vehicle panel, không ép trong max-width container.
- UI labels mặc định tiếng Việt; code/domain status vẫn giữ chuẩn technical.

### 3.2 Tokens

Tạo `styles/tokens.css` và mapping với Tailwind:

```text
Colors: background, surface, surface-muted, border, text-primary,
        text-secondary, brand, focus, success, warning, danger, info
Typography: font-family, text-xs/sm/base/lg, headings, mono
Spacing: 4px scale
Radius: 6 / 8 / 12px
Elevation: subtle shadow
Layout: sidebar 240–264px; topbar 64–72px
```

### 3.3 Components shared giữa 2 domain

| Nhóm        | Components                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------- |
| Navigation  | `AppShell`, `Sidebar`, `NavGroup`, `Topbar`, `Breadcrumb`, `PageHeader`, `UserMenu`           |
| Form        | `Button`, `Input`, `Select`, `FormField`, `Dialog`, `Drawer`, `ConfirmationDialog`            |
| Data        | `DataTable`, `TableToolbar`, `SearchInput`, `FilterPopover`, `Pagination`, `ColumnVisibility` |
| Feedback    | `StatusBadge`, `Toast`, `Alert`, `Skeleton`, `EmptyState`, `ErrorState`                       |
| Operational | `MetricCard`, `RentalTimeline`, `VehicleStatusBadge`, `GPSStatusBadge`, `AuditEventRow`       |
| Fleet Map   | `FleetMarker`, `VehicleSidePanel`, `TripSummary`, `MapToolbar`                                |

**Visual reference được khóa:** ảnh dashboard CarRent do user cung cấp ngày 22/10/2026; kế thừa bố cục và trải nghiệm, không sao chép logo/brand/mock data trong ảnh.

**Suggested UI tooling:** Tailwind + shadcn/ui/Radix, TanStack Table cho bảng; React Hook Form + Zod khi form complexity tăng. Mapbox GL JS cho map; **chưa cần cài Mapbox ngay ở Phase 1**. Không thêm Redux/microfrontend khi chưa cần.

**Boundary:** component thuần UI không tự gọi Supabase/DB; data access nằm trong `features/*/api`/hooks, sử dụng typed OpenAPI contracts.

---

## 3A. Visual Reference — Dashboard as Operational Command Center (Approved Direction)

> **Reference:** ảnh dashboard “CarRent” do product owner cung cấp ngày 22/10/2026. Đây là **visual/UI composition reference**, không phải specification về database, business workflow hay số liệu. Không sao chép nguyên brand, tên người, biển số, ngày, doanh thu hoặc asset có bản quyền từ ảnh mẫu.

### 3A.1 Exact UI characteristics to adopt

| Vùng trong ảnh    | Đặc điểm nhìn thấy                                                                         | Cách áp dụng Rental Fleet OS                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outer shell       | Canvas xám nhạt; app container bo góc, đường viền rất mảnh                                 | Dashboard workspace sáng, tinh gọn; shadow nhẹ, card separation rõ                                                                                                                                     |
| Left sidebar      | Brand đầu sidebar, action màu cam, user/business block, menu icons, Settings bottom        | BusinessShell: brand, **Create Rental** CTA, Business switcher, dashboard/vehicles/rentals/map/...; Superadmin thay CTA bằng **Create Business** chỉ khi API có                                        |
| Top bar           | Breadcrumb/title, compact icon buttons và Feedback                                         | PageTitle/breadcrumb + alerts + user menu; Superadmin thêm environment/tenant health indicator                                                                                                         |
| Main top-left     | **Map card chiếm khu vực lớn**, toolbar/search, marker xe, popover ảnh xe + rental details | Business Dashboard **Fleet Map Preview**; click marker mở vehicle/rental preview card; Mapbox dùng khi có GPS API, trước đó map prototype được gắn nhãn demo                                           |
| Main top-right    | 2×2 compact statistics cards với sparkline                                                 | Business: Available/Rented/Reserved/Overdue hoặc GPS Online/Offline; **không dùng Income/Expenses nếu domain data chưa có**. Superadmin: Active Businesses/Users/Total Vehicles/GPS Health khi API sẵn |
| Main bottom-left  | **Schedule** dạng timeline/Gantt theo xe, cột ngày/tuần, booking pills, vạch “today”       | `FleetSchedule`: rows = Vehicle, time axis = days/week, segments = reserved/active/overdue Rental; kiểm soát overlapping booking; demo data có nhãn                                                    |
| Main bottom-right | **Ongoing Order cards** có status, vehicle, renter, due date, arrow to detail              | `ActiveRentalQueue`: list ACTIVE/return soon/OVERDUE; quick open rental drawer/detail                                                                                                                  |
| Status styling    | Accent cam cho selected/action, green cho trạng thái tốt, neutral cho thông tin            | Màu status có text/icon; overdue danger, offline warning/neutral, không chỉ phụ thuộc màu                                                                                                              |
| Visual rhythm     | 2-column dashboard, card header có icon + subtitle, border nhẹ, padding compact            | Bố cục trực quan, có hierarchy, hạn chế chart decorative và large whitespace                                                                                                                           |

**Điểm thay đổi quan trọng so với plan cũ:** Không xem dashboard là hàng KPI/card rời rạc. **Map + Schedule + Action Queue là ba khu vực trọng tâm**, statistics chỉ đóng vai trò hỗ trợ.

### 3A.2 Business Admin Dashboard — Reference-based layout

```text
┌───────────────────┬───────────────────────────────────────────────────────────────────┐
│ Brand / Business  │ Dashboard                              Alerts / Feedback / User   │
│ + Create Rental*  ├────────────────────────────────────────┬──────────────────────────┤
│                   │ Fleet Map Preview                      │ 2 × 2 Stat Cards         │
│ Dashboard         │ Search / vehicle markers               │ Available  | Rented       │
│ Vehicles          │ Vehicle popover with renter & due      │ Reserved   | Overdue      │
│ Rentals           │                                        │                          │
│ Customers         ├────────────────────────────────────────┼──────────────────────────┤
│ Fleet Map         │ Fleet Schedule (week/day timeline)     │ Active Rental Queue      │
│ Trips             │ vehicle rows / reservation segments    │ ongoing / due / overdue  │
│ Commercial        │ today marker / horizontal scroll       │ compact cards            │
│ Users / Branches  │                                        │                          │
│ Settings          │                                        │                          │
└───────────────────┴────────────────────────────────────────┴──────────────────────────┘
```

`*` Create Rental chỉ thực thi khi Rental API tồn tại; trước đó là CTA chỉ xuất hiện trong dev prototype hoặc bị disable và ghi rõ “Sắp có”. Không được giả lập create thành công.

**Desktop grid suggestion:** Sidebar ~240–260px; main 12-column grid; Map & Schedule **span 8**, Stats & Active Queue **span 4** ở 1440px; gap 12–16px; map preview tối thiểu ~340px chiều cao. Không cố định 8/4 ở màn nhỏ khiến panel hẹp.

**UX interactions cần chứng minh trong prototype:**

1. Vehicle marker click → popover, hiển thị vehicle, `GPS lastSeen`, rental status, renter (khi authorized), due back; click **View Details** mở đúng detail.
2. Search/filter ở map chỉ lọc xe của tenant hiện tại; không tìm toàn platform.
3. Tab `Day / Week` đổi trục timeline; booking pills hiển thị range rõ, legend trạng thái và dòng hiện tại.
4. Click booking segment → Rental detail drawer; overlap không bị hiển thị như booking hợp lệ khi API hỗ trợ validation.
5. Active Rental Queue có tab `Ongoing / Due Soon / Overdue`, empty/loading/error, nút tới Rental detail.
6. Stats card dẫn tới danh sách tương ứng nếu có endpoint; nếu chưa có, card là preview không có action giả.
7. Timestamp dữ liệu GPS hiển thị timezone và trạng thái stale/offline; không mô tả last known thành live GPS.

**Data and current repo:** Fleet Map, Fleet Schedule, Rental Queue và fleet KPIs **chưa có domain API** trong `main`. Trong release hiện tại, giữ dashboard business thật bằng Business/Branch/Membership data, hoặc render **dev-only operational dashboard prototype** có banner `Dữ liệu minh họa`. Tuyệt đối không thay business dashboard production bằng mock fleet KPIs.

### 3A.3 Superadmin Dashboard — Same visual grammar, different content

Superadmin dùng **cùng** shell, card sizing, navigation rhythm, 2-column composition, nhưng **không bê Fleet Map/Schedule của tenant vào platform overview như KPI chính**.

- **Top-left (8 cols):** `Tenant Health Overview` với bảng/matrix trực quan (Business, Fleet size, Users, GPS health, activity), search/filter. Nếu sau này có tọa độ hợp pháp và nhu cầu thật, mới xét aggregate map; không coi bản đồ xe thuê là công cụ mặc định của platform operator.
- **Top-right (4 cols):** 2×2 metric cards `Active Businesses`, `Platform Users`, `GPS Online`, `GPS Delayed/Offline` (chỉ khi có API); hạn chế doanh thu SaaS chưa có billing.
- **Bottom-left (8 cols):** `Platform Activity Timeline` hoặc audit/event feed theo thời gian, không phải vehicle rental schedule.
- **Bottom-right (4 cols):** `Requires Attention` queue: offline integration, suspicious access, business suspended, pending support cases (chỉ hiển thị loại sự kiện backend có hỗ trợ).
- Action chính của Superadmin liên quan tới onboarding Business và tenant management; tuyệt đối không dùng “New Rental”.

**Authorization:** Vì repo chưa có global principal/API, **tất cả số liệu Superadmin là dev preview** cho tới khi hoàn thành platform RBAC và global read endpoints. Tắt các action chưa implemented.

### 3A.4 Design token overrides from reference

| Token            | Proposed baseline (tune in Figma) | Note                                 |
| ---------------- | --------------------------------- | ------------------------------------ |
| `--brand`        | `#E9702E` orange                  | Primary CTA, active filter, emphasis |
| `--canvas`       | `#F4F4F3`                         | Warm-neutral page background         |
| `--surface`      | `#FFFFFF`                         | Cards/panels                         |
| `--sidebar`      | `#F2F2F1`                         | Distinguishable sidebar              |
| `--border`       | `#DEDEDB`                         | Fine lines between compact panels    |
| `--text-primary` | `#2E3540`                         | Readability                          |
| `--text-muted`   | `#7C848C`                         | Metadata / descriptions              |
| `--success`      | Green semantic                    | Status only, not brand               |
| `--danger`       | Red semantic                      | Overdue, destructive                 |
| `--radius-card`  | `12px`                            | Dashboard cards                      |

Các mã màu trên là **initial implementation tokens** do chúng ta đề xuất dựa trên ảnh tham khảo, không phải màu đã trích xuất chính xác. Cần đối chiếu render với ảnh mẫu và accessibility trước khi freeze.

### 3A.5 Responsive and density requirements

- **≥1440px:** Map + Stats / Schedule + Queue hiển thị cạnh nhau; không cần scroll ngang toàn trang.
- **1024–1439px:** Ưu tiên Map → Stats → Schedule → Queue; 2-column tùy chiều rộng thực tế, cho phép nested card stack.
- **768–1023px:** Sidebar collapse, main sections 1-column, schedule có internal horizontal scroll.
- **<768px:** Chỉ cần graceful fallback của admin web; map có thể chuyển sang list/map toggle; không cố nhồi dashboard 4 vùng trên điện thoại.
- Card title thường 14–16px; body/data 12–14px tùy mật độ; click/touch targets đủ lớn, tooltip keyboard accessible.

### 3A.6 Dashboard design acceptance (visual)

- [ ] Thoạt nhìn dashboard có **Map, 2×2 Stats, Fleet Schedule, Active Rental Queue** rõ ràng như reference.
- [ ] Tỷ lệ diện tích map/timeline lớn hơn số liệu phụ; không chỉ là dashboard toàn KPI.
- [ ] Sidebar có action màu cam, user/business identity, icons, active nav, settings dưới cùng.
- [ ] Card headers gồm icon, title và subtitle nhỏ; border nhẹ, spacing thống nhất.
- [ ] Map popover có ảnh placeholder hợp lệ, plate/model/status/due time, không copy ảnh/sample data trong reference.
- [ ] Schedule thể hiện chiều thời gian và rental segments, khác hoàn toàn table thông thường.
- [ ] Các states thật của vehicle/GPS/rental không bị trộn vào một label.
- [ ] `Skeleton`, empty map, no rentals, offline GPS, partial data đều có thiết kế.
- [ ] Superadmin giữ visual language nhưng có Tenant Health và Platform Activity thay Fleet Schedule.
- [ ] No dummy KPI is presented as production data.

---

## 4. Target Web Architecture

```text
apps/web/src/
├── app/
│   ├── login/
│   ├── access-denied/
│   ├── (platform)/
│   │   └── superadmin/
│   │       ├── layout.tsx
│   │       ├── page.tsx              # Overview
│   │       ├── businesses/          # list/detail
│   │       ├── users/
│   │       ├── features/
│   │       ├── integrations/
│   │       ├── audit/
│   │       └── settings/
│   └── (tenant)/
│       └── app/
│           ├── layout.tsx
│           ├── page.tsx             # Dashboard
│           ├── business/
│           ├── users/
│           ├── branches/
│           ├── settings/
│           ├── audit/
│           ├── vehicles/             # preview
│           ├── rentals/              # preview
│           ├── customers/            # preview
│           ├── fleet-map/            # preview
│           ├── trips/                # preview
│           └── commercial/           # preview
├── components/
│   ├── ui/
│   ├── layout/
│   ├── data-display/
│   └── feedback/
├── features/
│   ├── business/
│   ├── memberships/
│   ├── branches/
│   ├── settings/
│   ├── tenant-audit/
│   ├── platform/                # preview pending backend
│   ├── fleet/                   # preview pending backend
│   ├── rental/                  # preview pending backend
│   └── map/                     # preview pending backend
├── lib/
│   ├── api.ts
│   ├── api-client/
│   ├── supabase/
│   └── permissions/
└── styles/tokens.css
```

**Routing:** Next.js route groups không đổi URL. Giữ các URL `/app`, `/app/business`, `/app/users`, `/app/branches`, `/app/settings`; nếu chuyển path, thêm redirect có kiểm thử. Không để duplicate routes giữa `(tenant)` và legacy directory.

**Security:** `src/proxy.ts` hiện bảo vệ `/app/:path*`, chưa bảo vệ `/superadmin/:path*`. Trước khi public bất kỳ Superadmin route thật nào, mở rộng matcher và có global authorization ở server/backend. **Không coi hide menu hoặc frontend redirect là bảo mật đầy đủ.**

---

## 5. Superadmin — Screen Matrix

**Purpose:** nền tảng SaaS, không phải dashboard của 1 business.

| Priority | Screen                   | Content                                                                               | API readiness    |
| -------- | ------------------------ | ------------------------------------------------------------------------------------- | ---------------- |
| P0       | Platform Overview        | Active Businesses, Fleet, Rentals, GPS online/offline, Users, Tenant Health, Activity | **Preview only** |
| P0       | Businesses               | business table, status, fleet/users, filters, create UI                               | **Preview only** |
| P0       | Business Detail          | Overview, Users, Configuration, Features, Integration Health                          | **Preview only** |
| P1       | Users                    | cross-tenant support view                                                             | **Preview only** |
| P1       | Feature Management       | GPS/Toll/Deposit/Revenue/Customer Portal entitlements                                 | **Preview only** |
| P1       | GPS / Integration Health | device count, provider, delay, offline, tenant filters                                | **Preview only** |
| P1       | Audit Logs               | platform-wide audit view                                                              | **Preview only** |
| P2       | System Settings          | platform defaults, integration configuration state                                    | **Preview only** |

### Superadmin technical guardrails

1. `OWNER` của tenant không được tự động có global quyền.
2. Tạo **dedicated platform role/guard** trong một backend epic độc lập trước khi nối live global data.
3. Không duyệt qua từng `business_id` bằng browser/service key để ghép dashboard toàn platform.
4. Action Suspend Business / Feature Toggle phải disabled trong UI preview; không thông báo thành công giả.
5. Dùng fixtures tổng hợp, không dùng thông tin khách hàng thật.
6. Khi chưa có backend, production có thể hiển thị “Chức năng đang phát triển” thay vì mock metrics.
7. Audit global phải riêng với `GET /audit-logs` hiện tại (tenant-scoped).

---

## 6. Business Admin — Screen Matrix

**Purpose:** operator của doanh nghiệp thuê xe, context luôn gắn membership/business.

| Priority | Screen              | UX target                                                               | Data readiness                 |
| -------- | ------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| P0       | Business Shell      | brand, left nav, business picker, profile, logout                       | **Live** `/me`                 |
| P0       | Dashboard (interim) | workspace overview, business/branch setup, action items có dữ liệu thật | **Live**, no fake fleet KPI    |
| P0       | Business Profile    | profile card + edit form                                                | **Live** `/businesses/current` |
| P0       | Users & Roles       | members table, role/status, edit drawer, pagination                     | **Live** `/memberships`        |
| P0       | Branches            | table, create/edit, status, pagination                                  | **Live** `/branches`           |
| P0       | Settings            | business-specific locale/date format                                    | **Live** `/settings`           |
| P1       | Audit               | audit table chỉ với quyền `audit.read`                                  | **Live** `/audit-logs`         |
| P1       | Vehicles            | filters, status, profile, GPS indicator                                 | **Preview only**               |
| P1       | Rentals             | create wizard, lifecycle/detail, overdue                                | **Preview only**               |
| P1       | Customers           | contacts + rental history                                               | **Preview only**               |
| P1       | Fleet Map           | vehicle list/filter + full map + detail panel                           | **Preview only**               |
| P1       | Trips               | path, timeline, distance                                                | **Preview only**               |
| P2       | Commercial          | Deposit / Toll / Revenue Visibility, no full accounting                 | **Preview only**               |

### Business Admin UX rules

- Preserve tenant isolation, RBAC and `current-business` switch; scope all frontend cache state by verified tenant.
- `OPERATIONS` role không thấy write UI khi không có permission, backend vẫn kiểm tra.
- Users màn hình hiện chỉ thêm người bằng **Supabase Auth User ID** đã tồn tại. Không giả lập email invite trước khi có API.
- Giữ danh sách feature tương lai được gắn nhãn **Preview** trong dev, không hiển thị như live production.
- Tách `VehicleStatus` và `GPS online/offline`; `OVERDUE` là condition từ Rental ACTIVE vượt `end_at`.
- Deposit theo Rental, Toll theo Trip/Rental, Revenue Visibility ở mức signals; không xây P&L kế toán, khấu hao, bảo dưỡng.

---

## 7. Implementation Phases

### Phase 0 — Baseline & Design Freeze (P0)

**Tasks**

- [ ] Checkout latest `main`, ghi commit SHA.
- [ ] Đọc `AGENTS.md`, `apps/web/AGENTS.md`, `docs/development.md` trước khi chỉnh source.
- [ ] Chụp ảnh màn Login, Dashboard, Business, Users, Branches, Settings, Access Denied/Error ở desktop/tablet.
- [ ] Chốt UI reference: **dashboard CarRent image (22/10/2026)**; layout map/statistics/schedule/queue cho Business, tenant-health/activity cho Superadmin.
- [ ] Chốt spacing, typography, **orange accent palette**, density, shell và desktop 1440px wireframe.
- [ ] Tạo inventory: màn nào đang có API, màn nào preview, màn nào cần backend epic.
- [ ] Chốt navigation của Superadmin và Business Admin, tránh lẫn role.

**Exit:** screenshot baseline + screen inventory + design spec; chưa đổi DB.

### Phase 1 — Shared Design System & Shell (P0)

- [ ] Tạo semantic tokens và component styles **theo ảnh reference**, ưu tiên orange/coral accent, neutral gray, white cards.
- [ ] Tạo `DashboardGrid`, `PanelHeader`, `CompactStatCard`, `ActionQueueCard` theo visual reference.
- [ ] Dọn global element CSS selectors, tránh `header`/`aside` ảnh hưởng tất cả pages.
- [ ] Build Button, Input, Select, Badge, Card, Table, Pagination, Skeleton, Toast, Dialog, Drawer.
- [ ] Xây `BusinessShell` chuẩn B2B SaaS với active nav, breadcrumb, user menu, role badge, tenant switch.
- [ ] Xây `PlatformShell` visual prototype, tách brand/context khỏi tenant shell.
- [ ] Giữ SSR auth, login, logout, redirect, access-denied, business picker.
- [ ] Responsive sidebar và table scroll; accessible keyboard/focus.

**Exit:** hai shells thống nhất visual language; các route live vẫn hoạt động.

### Phase 2 — Rebuild Existing Business SaaS Core (P0)

- [ ] Tách `resource-panel.tsx` thành `features/business`, `memberships`, `branches`, `settings`.
- [ ] Refactor API mutation và errors theo typed data layer; giữ endpoint/payload cũ.
- [ ] Business Profile: form validation, card layout, save/cancel/loading/error.
- [ ] Members: DataTable, role/status badges, edit drawer, form thêm User ID và message rõ ràng.
- [ ] Branches: list/search (client-side nếu hợp lý), create/edit, pagination.
- [ ] Settings: form sections locale/date format.
- [ ] Tenant Audit: list ở role có `audit.read`; không fake global audit.
- [ ] Test OWNER, ADMIN, OPERATIONS; bảo vệ last owner; 401/403; tenant switch.

**Exit:** CRUD live không regression; UI phù hợp design đã chốt.

### Phase 3 — Superadmin Visual Prototype (P0/P1)

- [ ] Platform Overview theo **same composition**: Tenant Health (top-left), 2×2 Platform KPIs (top-right), Platform Activity timeline (bottom-left), Requires Attention queue (bottom-right); không copy fleet map của tenant. Fixtures phải gắn nhãn.
- [ ] Businesses list + Business Detail tabs.
- [ ] Users / Feature Management / GPS Integration Health / Audit / System Settings.
- [ ] Xây consistent filters, status indicators, details drawers.
- [ ] Tạo backend readiness checklist cho platform endpoints, global RBAC và audit.
- [ ] Không expose global real data, không mở action write production.

**Exit:** Figma-aligned Superadmin prototype không tạo privilege escalation.

### Phase 4 — Business Fleet Workflow Prototypes (P1)

- [ ] Vehicles list/profile design.
- [ ] Rentals list/create/detail với lifecycle timeline.
- [ ] Customers list/profile.
- [ ] Fleet Map: left vehicle list, marker styles, search/filter, map side panel.
- [ ] **Reference dashboard prototype:** 8/4 grid gồm Map + 2×2 Stats + Fleet Schedule timeline + Active Rental Queue.
- [ ] Tạo Fleet Schedule dạng timeline theo xe, Day/Week toggle, booking segments, today marker; prototype data được gắn nhãn.
- [ ] Dashboard click path marker→detail, schedule segment→rental drawer, queue→rental detail.
- [ ] Trips: route/path summary, sample data.
- [ ] Commercial: Deposit/Toll/Revenue Visibility — không full accounting.
- [ ] Mọi data giả được đánh dấu, tác vụ chưa có backend bị disabled.

**Exit:** Business UI minh họa đầy đủ target product nhưng không hứa functionality chưa có.

### Phase 5 — QA & Controlled Rollout (P0)

- [ ] Visual review desktop 1440/1280/1024 + tablet.
- [ ] Empty/loading/error/disabled states trên tất cả màn quan trọng.
- [ ] Accessibility: keyboard navigation, focus, contrast, form labels, dialog focus.
- [ ] Auth/tenant isolation/RBAC regression; tenant switching không để stale context.
- [ ] Chạy `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [ ] `pnpm test:e2e` chỉ trong **dev project**, không seed staging/prod.
- [ ] Triển khai trước các màn Business live; Superadmin preview chỉ cho developer/authorized testers.

**Exit:** visual approved + tests green + no security regression.

---

## 8. Agent-Friendly Ticket Backlog

| ID     | Priority | Task                                               | Depends on     | Acceptance                                        |
| ------ | -------- | -------------------------------------------------- | -------------- | ------------------------------------------------- |
| UI-001 | P0       | Route/API/UI audit và screenshots                  | —              | Inventory verified                                |
| UI-002 | P0       | Tokens, theme, typography                          | UI-001         | Consistent styles                                 |
| UI-003 | P0       | Shared UI component primitives                     | UI-002         | Reusable component states                         |
| UI-004 | P0       | BusinessShell redesign                             | UI-003         | Existing routes/auth work                         |
| UI-005 | P0       | Typed API/permission state cleanup                 | UI-004         | No auth/tenant regressions                        |
| UI-006 | P0       | Business/Settings pages                            | UI-005         | Working live forms                                |
| UI-007 | P0       | Users & Roles redesign                             | UI-005         | Working list/update/role rules                    |
| UI-008 | P0       | Branches + Tenant Audit redesign                   | UI-005         | Working list/edit/access                          |
| UI-009 | P0       | PlatformShell preview                              | UI-003         | No elevated data exposed                          |
| UI-010 | P0       | Superadmin Overview & Businesses preview           | UI-009         | Figma-equivalent mock screens                     |
| UI-011 | P1       | Remaining Superadmin preview pages                 | UI-010         | All screens complete visually                     |
| UI-012 | P1       | Vehicles/Rentals/Customers preview                 | UI-003         | Domain-consistent UI                              |
| UI-013 | P1       | Fleet Map & Trips preview                          | UI-012         | Map + route UX                                    |
| UI-014 | P2       | Commercial preview                                 | UI-012         | Deposit/Toll/Revenue only                         |
| UI-015 | P0       | Regression/visual review                           | UI-004—014     | Tests + signoff                                   |
| UI-016 | P0       | Dashboard visual reference spec + 1440px wireframe | UI-001         | Map/Stats/Schedule/Queue layout approved          |
| UI-017 | P1       | Fleet Schedule reusable timeline prototype         | UI-003, UI-016 | Vehicle rows, Day/Week, booking pills, today line |
| UI-018 | P1       | Business dashboard 4-panel visual prototype        | UI-013, UI-017 | Match reference hierarchy; demo banner            |
| UI-019 | P0       | Superadmin platform dashboard visual composition   | UI-009, UI-016 | Tenant health/activity/attention layout           |

**Implementation rule:** một ticket/nhóm nhỏ ticket cho mỗi PR; không rewrite toàn bộ `apps/web` một lần.

---

## 9. API Readiness Matrix

| Screen              | Existing endpoint                                 | API còn thiếu                              |
| ------------------- | ------------------------------------------------- | ------------------------------------------ |
| Business Shell      | `GET /api/v1/me`                                  | —                                          |
| Business Profile    | `GET/PATCH /businesses/current`                   | Extra profile fields nếu scope mới cần     |
| Users/Memberships   | `GET/POST /memberships`, `PATCH /memberships/:id` | Email invite flow                          |
| Branches            | `GET/POST /branches`, `PATCH /branches/:id`       | Branch analytics                           |
| Settings            | `GET/PATCH /settings`                             | Advanced tenant config                     |
| Tenant Audit        | `GET /audit-logs`                                 | Advanced filters nếu cần                   |
| Platform Overview   | —                                                 | Global aggregates + platform RBAC          |
| Platform Businesses | —                                                 | Global list/detail/create/suspend APIs     |
| Platform Features   | —                                                 | Feature entitlement management             |
| GPS Health          | —                                                 | Device/provider status + ingestion metrics |
| Vehicles            | —                                                 | Fleet domain/API                           |
| Rentals             | —                                                 | Rental domain/API                          |
| Customers           | —                                                 | Customer domain/API                        |
| Trips/Fleet Map     | —                                                 | Telematics/Trip/Map API                    |
| Commercial          | —                                                 | Deposit/Toll/Revenue APIs                  |

**Note:** Không tự tạo API hoặc table chỉ để khớp screenshot mà không qua backend design/approval.

---

## 10. QA & Acceptance Criteria

### Shared

- [ ] Không còn giao diện template mặc định; typography, color, spacing nhất quán.
- [ ] Tất cả nav active/hover/focus/disabled hoạt động rõ ràng.
- [ ] DataTable có search/filter/pagination khi data/API cho phép.
- [ ] Loading, empty, error, successful mutation, permission denied có state rõ.
- [ ] Không phát sinh XSS/secrets exposure, không làm hỏng tenant isolation.

### Superadmin

- [ ] Domain khác Business Admin rõ ở layout/menu/context.
- [ ] Overview, Businesses, Business Detail là các màn demo trọng tâm.
- [ ] Các tính năng toàn platform chỉ preview tới khi backend authorization riêng hoàn tất.
- [ ] Không giả mạo platform metrics hoặc hành động Suspend/Toggle có thật.

### Business Admin

- [ ] Profile, Memberships, Branches, Settings CRUD live hoạt động.
- [ ] Role OWNER/ADMIN/OPERATIONS hiển thị action theo permission, backend enforce.
- [ ] Tenant switch đúng context; cache không lộ tenant trước.
- [ ] Fleet Map dùng bố cục map + panel, status GPS tách khỏi Rental status.
- [ ] Commercial chỉ gồm Deposit/Toll/Revenue Visibility ở mức đơn giản.

---

## 11. Risks & Mitigation

| Risk                          | Mitigation                                                        |
| ----------------------------- | ----------------------------------------------------------------- |
| UI rewrite phá auth/routes    | Refactor từng page, preserve SSR/proxy, test trước/sau            |
| `/superadmin` route bị public | Route guard + dedicated global RBAC; preview không dùng live data |
| Hardcoded CSS xung đột        | Design tokens, component-scoped styles                            |
| Mock KPI trông như production | Explicit `Preview` label, dev-only fixture, disabled actions      |
| Tenant data cache stale       | Include verified business ID in cache/query keys; reset on switch |
| UI vượt xa backend            | API readiness matrix + future backend backlog                     |
| Code duplication giữa domains | Shared primitives, separate shells/features                       |
| Thêm thư viện quá mức         | Incremental dependency adoption                                   |

---

## 12. Deliverables

1. `docs/ui-reimplementation-plan.md` (nội dung tài liệu này).
2. `docs/ui-screen-inventory.md` — current vs target screens + API readiness.
3. `docs/ui-design-tokens.md` — approved visual system.
4. Shared `components/ui`, `layout`, `data-display`, `feedback`.
5. Business Admin redesigned, **working** trên SaaS Core APIs.
6. Superadmin high-fidelity UI **preview**, chờ platform APIs/authorization.
7. Business Fleet/Map/Rental high-fidelity **preview**, chờ domain APIs.
8. Before/after screenshots, accessibility notes, test/regression report.
9. Backend epics riêng cho global Superadmin và future fleet domains.

---

## 13. First Execution Batch (Recommended)

**Batch A — ưu tiên chất lượng UI thật:**

1. UI-001: audit + screenshot baseline.
2. UI-002: tokens/design system.
3. UI-003: reusable UI primitives.
4. UI-004: BusinessShell redesign giữ nguyên auth/routes.
5. UI-006/UI-007: Business Profile + Users/Memberships redesigned với data thật.
6. Visual signoff, sau đó mới làm Branches/Settings/Audit và Superadmin preview.

**Batch B:** Superadmin Preview → Vehicles/Rentals/Fleet Map preview. Đừng làm một PR chứa toàn bộ màn hình.

### Coding Agent Prompt — Batch A

> Read `AGENTS.md`, `apps/web/AGENTS.md`, `docs/development.md` and inspect all existing Web routes before editing. Work only on UI-001 through UI-004 from `docs/ui-reimplementation-plan.md`, then prepare UI-006/UI-007 as a separate PR. Preserve Next.js 16.3.5, Supabase SSR Auth, NestJS API contracts, `/app` URLs, `current-business` behavior, RBAC and tenant isolation. Build semantic design tokens, reusable UI components, and a polished Business Admin shell. Do not change database migrations, backend APIs, service keys or permission logic. Do not use fake production KPIs or expose Superadmin real data. Run `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`; report changed files and before/after screenshots. Follow repo server/process instructions: do not start persistent services without authorization.

---

## 14. Source Links

- [Repository](https://github.com/nhuffan/rental-fleet-operating-system)
- [Web shell](https://github.com/nhuffan/rental-fleet-operating-system/blob/main/apps/web/src/app/app/layout.tsx)
- [Current CRUD panel](https://github.com/nhuffan/rental-fleet-operating-system/blob/main/apps/web/src/app/app/resource-panel.tsx)
- [Current styles](https://github.com/nhuffan/rental-fleet-operating-system/blob/main/apps/web/src/app/globals.css)
- [NestJS core endpoints](https://github.com/nhuffan/rental-fleet-operating-system/blob/main/apps/api/src/core/core.controller.ts)
- [Current RBAC](https://github.com/nhuffan/rental-fleet-operating-system/blob/main/apps/api/src/auth/permissions.ts)
- [Development guide](https://github.com/nhuffan/rental-fleet-operating-system/blob/main/docs/development.md)

**Final architecture boundary:** **Superadmin = platform-level SaaS operations**; **Business Admin = tenant-level fleet operations**. Shared components, different shells and permissions. Backend is always the authorization source of truth.
