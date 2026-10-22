# UI design system

Source: `apps/web/src/styles/tokens.css`, `base.css`, `operational.css`.

The supplied Markdown composition is the design reference. The original CarRent reference image was not attached to this implementation task; exact image-to-render matching remains a product review step.

| Token               | Value                            | Use                                            |
| ------------------- | -------------------------------- | ---------------------------------------------- |
| `--brand`           | `#E9702E`                        | Markers, selection and timeline emphasis       |
| `--brand-strong`    | `#AD4511`                        | Accessible accent text / focus                 |
| Primary button fill | `#BE4E18`                        | Darker orange for readable white button labels |
| `--canvas`          | `#F4F4F3`                        | Workspace                                      |
| `--surface`         | `#FFFFFF`                        | Panels and forms                               |
| `--sidebar`         | `#F2F2F1`                        | Sidebar                                        |
| `--border`          | `#DEDEDB`                        | Fine separators                                |
| `--text-primary`    | `#2E3540`                        | Main text                                      |
| `--text-secondary`  | `#606973`                        | Secondary labels                               |
| `--success`         | `#24734E`                        | Positive state                                 |
| `--warning`         | `#885B12`                        | Stale data / preview                           |
| `--danger`          | `#B63D42`                        | Overdue / API failure                          |
| `--info`            | `#356482`                        | Informational state                            |
| Radius              | 6 / 8 / 12px                     | Controls / drawers / panels                    |
| Sidebar / topbar    | 248px / 68px                     | Desktop layout                                 |
| Base typography     | 14px Arial/Helvetica/system sans | Vietnamese support; no network font dependency |

Tailwind semantic mappings live in `@theme inline`. Shared components use scoped classes. Element-wide navigation, table, button, input and shell selectors from the original theme were removed. Global rules are limited to document typography/reset and focus behavior.

## Reusable components

- UI: Button, Badge, StatusBadge, Panel, PanelHeader, PageHeader, EmptyState, Skeleton and Icon.
- Data display: typed DataTable, SearchInput and Pagination.
- Feedback: MutationNotice with alert/status live regions.
- Overlay: native modal Drawer with labelled title, Escape handling, browser focus containment, trigger focus restoration and title-change focus.
- Layout: shared AppShell with Business / Platform variants, active navigation, breadcrumbs, tenant switch, mobile navigation and role/user identity.
- Operational: FleetMap, FleetSchedule, ActiveRentalQueue, VehicleBadge, GPSBadge, RentalBadge and original SVG car thumbnails.

Native dialogs/selects were preferred over adding packages solely for visual parity. No dependency or lockfile changes were needed. Additional primitives such as destructive confirmation dialogs should be added with the backend operation that requires them; previews cannot perform destructive writes.

## Responsive behavior

1440px: Map / Schedule and Stats / Queue use 8:4 proportions. 1280px retains two columns where usable. At 1024px, major panels stack and metrics use four columns. Below 1024px, navigation is collapsible. Below 768px, metrics use two columns, queue cards stack, map/list switching is available and the schedule scrolls internally. Tables always scroll inside their panels.

Status badges include text as well as color. Vehicle availability, GPS signal and rental overdue are independent concepts. Overdue is derived from ACTIVE rental + end time before the fixed fixture timestamp. Synthetic GPS state is always labelled historical, using UTC+7, never advertised as live tracking.
