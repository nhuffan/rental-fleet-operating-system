# UI screen inventory

Baseline: `59cc975669b3c2716dc0d6cb4b4e56e847022804` (main, 22 October 2026).

The active working checkout is `/Users/nhuffan/Documents/Projects/Car Rental Fleet Operation ` on the existing `main` branch (the directory name includes a trailing space). The UI changes were transferred here from the initial implementation copy after verifying both checkouts had the same base commit and this checkout had no local changes. That initial UI rollout changed no API, permission map, database schema, contract, dependency or environment file. Stage 3 subsequently adds live Fleet Core as documented below.

| URL                                                              | Mode                      | Data / behavior                                                                                                  |
| ---------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/login`                                                         | Live                      | Existing Supabase password login, SSR session, logout and redirect behavior                                      |
| `/app`                                                           | Live                      | Verified `/me`, branch total, membership total only with `user.read`; no fleet metrics                           |
| `/app/business`                                                  | Live                      | GET/PATCH `/businesses/current`, profile form, permission-based read-only state                                  |
| `/app/users`                                                     | Live                      | GET/POST/PATCH `/memberships`, current-page search/status filters, server pagination, create/edit drawer         |
| `/app/branches`                                                  | Live                      | GET/POST/PATCH `/branches`, search/status filters, server pagination, create/edit drawer                         |
| `/app/settings`                                                  | Live                      | GET/PATCH `/settings`, locale and date format                                                                    |
| `/app/audit`                                                     | Live                      | GET `/audit-logs`, server-side `audit.read` check, pagination and timezone-aware display                         |
| `/access-denied`                                                 | Live                      | Retry / logout; no tenant information exposed                                                                    |
| `/app/{rentals,customers,fleet-map,trips,commercial}`            | Development preview       | Authenticated tenant shell; clearly separate synthetic fixtures, production returns unavailable / 404 after auth |
| `/dev-preview/business`                                          | Development preview       | Map + computed fixture statistics + vehicle schedule + rental queue                                              |
| `/dev-preview/business/vehicles`                                 | Development preview       | Vehicle filters, client pagination, vehicle detail and separate GPS status                                       |
| `/dev-preview/business/rentals`                                  | Development preview       | Rental filters/detail/lifecycle; 3-step creation walkthrough, final write disabled                               |
| `/dev-preview/business/customers`                                | Development preview       | Synthetic profiles with linked rental history; no real contact information                                       |
| `/dev-preview/business/fleet-map`                                | Development preview       | Full map canvas, searchable vehicle panel, last-known timestamps, mobile list fallback                           |
| `/dev-preview/business/trips`                                    | Development preview       | Synthetic route diagram, distance/time/toll summary linked to rental                                             |
| `/dev-preview/business/commercial`                               | Development preview       | Deposit by rental, toll by trip/rental, revenue unavailable; no accounting                                       |
| `/dev-preview/business/{business,users,branches,settings,audit}` | Development preview       | Read-only synthetic examples of SaaS Core components                                                             |
| `/dev-preview/platform`                                          | Development preview       | Tenant Health, 2×2 metrics, Platform Activity, Requires Attention                                                |
| `/dev-preview/platform/businesses`                               | Development preview       | Search/status filters, tenant health and details links                                                           |
| `/dev-preview/platform/businesses/{fixture-id}`                  | Development preview       | Overview / Users / Configuration / Features / Integration tabs                                                   |
| `/dev-preview/platform/users`                                    | Development preview       | Cross-tenant synthetic support view                                                                              |
| `/dev-preview/platform/features`                                 | Development preview       | Entitlement states; changes disabled                                                                             |
| `/dev-preview/platform/integrations`                             | Development preview       | Provider/device counts and historical connection state                                                           |
| `/dev-preview/platform/audit`                                    | Development preview       | Synthetic event timeline/details; separate from tenant audit                                                     |
| `/dev-preview/platform/settings`                                 | Development preview       | Disabled defaults and backend readiness list                                                                     |
| `/superadmin/*`                                                  | Unavailable in production | Development redirects to synthetic platform preview; never authorizes tenant OWNER as platform admin             |

### Live Fleet routes added by Stage 3

| URL                     | Mode | Data / behavior                                                                                       |
| ----------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `/app/vehicles`         | Live | Tenant-scoped vehicle search/status/branch filters, sorting, pagination, create/edit and lifecycle    |
| `/app/vehicles/devices` | Live | Tenant-scoped GPS device registry, provider/status filters, immutable identity, create/edit lifecycle |
| `/app/vehicles/:id`     | Live | Vehicle profile, current registered device, paginated assignment history, assign/end forms            |

All preview entry points check `NODE_ENV === "development"` on the server before importing fixture modules. Previews are deliberately unavailable under `next start`, including staging/test environments. There is no flag to turn them into live platform screens.

Existing `/app` URLs are preserved by explicit feature routes, replacing the old `[section]` dispatcher without redirects or duplicate routes. Shells share tokens/components while retaining different menus, context and CTA text. No map SDK, additional UI package, service key or external image dependency was introduced.

## Stage 3 live Fleet Core update

The inventory above records the earlier UI rollout. Stage 3 promotes `/app/vehicles` to a live tenant-scoped screen, adds `/app/vehicles/devices` for GPS registration and `/app/vehicles/:id` for profile/current device/history. These routes use the generated Fleet API contracts in production and never import preview fixtures. `/dev-preview/business/vehicles` remains a synthetic design example. All other operational prototypes and platform routes retain their original development-only boundary.

See [Fleet Core architecture](fleet-core.md) and [Stage Output](../STAGE_OUTPUT.md) for the current API readiness and verification results.
