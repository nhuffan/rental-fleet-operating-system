# Development

## Run and verify

Implementation stages run focused changed-path/security tests, build/typecheck and lint for touched workspaces. Full historical E2E, broad browser/viewport matrices and load benchmarks belong to Final Validation unless a concrete regression requires them. Critical authorization failures must be fixed before delivery.

Use pnpm 11.19.0; project scripts select Node 24.21.0. Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/api/.env.example` to `apps/api/.env` on a new checkout. Supply real values locally only.

```sh
pnpm install --frozen-lockfile
pnpm dev                 # Web :4000, API :9000; Ctrl+C stops both
pnpm dev:web             # Web only :4000
pnpm dev:api             # API only :9000
pnpm build
pnpm lint
pnpm typecheck
pnpm test                # domain/security tests and clean-database migration replay
pnpm test:e2e            # full real dev suite; reserved for Final Validation or a concrete regression
pnpm openapi             # after API build; exports spec and generated types
```

Local Web: `http://localhost:4000` (fixed by both `dev` and `start` scripts). Local API: `http://127.0.0.1:9000`; `WEB_ORIGIN=http://localhost:4000`. Keep local env files aligned with their examples, including `NEXT_PUBLIC_API_BASE_URL`. These ports belong to this Rental project; do not stop another project's listener when a conflict occurs.

API prefix: `/api/v1`. Swagger: `/api/docs`; JSON: `/api/openapi.json` (disabled in production). Errors contain `statusCode`, `code`, `message`, `requestId`, without database/provider details. Standard lists accept `page` (default 1) and `limit` (default 20, maximum 100), with stable ID tie-breaking. Dates use explicit UTC offsets and API output is UTC ISO; the UI formats operational times in `Asia/Ho_Chi_Minh`.

Ask before starting a server unless the user has already authorized it for the task. Record owned sessions/PIDs/ports; stop temporary servers, watchers and containers on completion/failure and verify they exited. Retain dev servers only when the user requests it. Never stop unrelated/user-owned processes or use broad kill commands.

## Database and demo login

Drizzle is the query layer. SQL migrations in `supabase/migrations` are the sole schema source of truth; `apps/api/src/database/schema.ts` maps the query types. Create files with `supabase migration new descriptive_name`, test with `pnpm test`, then `pnpm db:migrate`. The migration command checks `SUPABASE_PROJECT_REF` against `SUPABASE_URL`, links that project and uses Supabase migration history. Supabase CLI must be installed and authenticated. Preview with `pnpm --filter api db:migrate --dry-run`.

`DATABASE_URL` is the PostgreSQL URI from Connect → Session pooler, with a URL-encoded password and no placeholder brackets. The client verifies TLS using `infra/certs/supabase-ca.crt` (public CA downloaded from the Dashboard); override `DATABASE_CA_PATH` if another CA is required. Never disable certificate/hostname verification. Idle pool errors log only a redacted event/type, never the connection/client or error message.

Only development project **eeryymswcufnebibigqf** may be used for account setup/E2E/GPS maintenance. The configured named development accounts live only in ignored root `.env.accounts.json` (mode 0600), with the three requested identities: Superadmin, Owner and deferred Customer. Never print or commit this file, passwords, real env values, tokens or server keys. The Owner has access to both retained demo businesses; Superadmin has independent platform access only. Customer has a confirmed Auth identity/profile and no business/platform membership; no customer portal is implemented.

Persistent example-account seeding is retired. `pnpm db:seed` deliberately refuses without changing data, and `platform:seed` rejects the retired `.env.demo.json` marker. These commands cannot silently recreate the removed example identities. Named accounts are provisioned through a trusted administrator using Supabase Auth Admin API and server-side membership tables, with no email invitations or role claims trusted from metadata.

Real E2E suites use run-scoped disposable fixtures, never `.env.accounts.json` or named personal credentials. They require the exact development project, `APP_ENV=development`, `ALLOW_DEMO_SEED=true` and a local server key. Each suite owns isolated businesses/branches/Auth IDs and cleans exact owned operational records and identities in `afterAll`, retaining audit history; audit-bearing businesses remain disabled tombstones because tenant audit has a business FK. Suites remain serial for predictable fixture load. Never disable/demote/reset named accounts or delete unrelated data. Full historical E2E remains reserved for Final Validation.

## Architecture and security

- Web uses per-request Supabase SSR clients, cookie refresh in `proxy.ts` and protected server layouts. It forwards bearer tokens to NestJS; browser code receives only the publishable key. A business switch reloads the document so prior tenant form/list/map state cannot survive.
- NestJS verifies Supabase Auth, then active profile, business and membership. Optional `X-Business-Id` selects a verified active membership; otherwise the oldest active membership is selected. Never authorize with `user_metadata`, a browser-supplied business ID, hidden menu or frontend state.
- The application has two active surfaces: Superadmin (internal platform role `PLATFORM_OPERATOR`) and business `OWNER`. Owner receives the existing tenant operational permissions; legacy ADMIN/OPERATIONS and deferred Customer receive none. Member creation accepts only `userId` and always grants OWNER; update accepts only required ACTIVE/DISABLED `status`. Role selection/hierarchy and permission matrices/counts are removed from UI. The last effective active Owner cannot be disabled. Backend permission guards remain independent of UI and metadata.
- Every tenant resource query includes the verified business ID. Platform read APIs use independent active platform membership/profile/permission checks and return approved global metadata/aggregates; a tenant role or selected-business header never grants global access. Mutations acquire the business row lock, recheck current profile/business/membership/permission and write the resource and audit event in one transaction. Membership revocation and domain writes share that lock. Unique/exclusion constraints provide a second concurrency defense.
- Audit metadata contains request IDs and changed field names, not bodies, coordinates, tracker identifiers, credentials, contacts, notes or amounts. Wrapped database errors map to stable public conflict codes.
- Exposed tables enable RLS. Tenant registry/customer/rental Data API reads require active membership/profile/business; direct writes by `anon`/`authenticated` are revoked. `gps_positions` denies all Data API reads and writes, with RLS enabled and no read policy. The API's trusted database connection still must enforce tenant authorization itself. No `SECURITY DEFINER` authorization helper is used.
- Generated OpenAPI and TypeScript contracts live in `packages/contracts`; regenerate after API changes. Database schema, credentials and provider secrets remain server-only.

Domain boundaries are `apps/api/src/fleet/vehicles`, `apps/api/src/rentals`, `apps/api/src/telematics/{gps,trips}` and the independently authorized `apps/api/src/platform`. Web live features follow `features/fleet/vehicles`, `features/rentals` and `features/telematics/{gps,trips}`; synthetic business examples live in `features/previews/business`; platform live components/data access are under `features/platform/live`, alongside the separate development preview. Shared UI/data-display/overlay components contain presentation behavior rather than tenant business rules. Routes and API payloads remain stable during structural moves.

The Owner-only migration refuses while any legacy non-OWNER membership remains, including disabled rows. Resolve those identities explicitly before applying it; the migration never promotes staff into Owner or deletes historical data. It restricts the DB check to OWNER and tenant audit RLS to active Owner/profile/business. Current Auth account-type labels are descriptive only and are not authorization inputs.

## Platform console

`/superadmin`, `/superadmin/businesses`, `/superadmin/businesses/:id`, `/superadmin/audit`, `/superadmin/users` and `/superadmin/users/:id` are live read-only platform views. Enter through `/superadmin` or `/login?next=/superadmin`. Server layouts/pages verify platform context through NestJS; the proxy refreshes Auth and redirects unauthenticated `/superadmin/*` to platform login. Local return paths allow only `/app` or `/superadmin` descendants, normalize traversal, reject external/control/out-of-scope destinations, and preserve deep links. The generic `/login` selects a landing from verified NestJS grants after Auth succeeds: tenant `/me` success enters `/app`; only tenant denial triggers the independent `/platform/me` check for `/superadmin`. Accounts without either grant reach access denied. Network/unexpected API failures stay on the form. Valid explicit `next` destinations are preserved and authorized by their protected layout; invalid return paths are ignored before this default selection. No email or Auth metadata grants access.

Supabase supplies identity only. `AuthGuard` verifies the current user; `PlatformGuard` checks an ACTIVE `user_profiles` row plus an independent ACTIVE `platform_memberships` row with role **PLATFORM_OPERATOR**. Tenant OWNER, retired roles, `user_metadata`, the business cookie and `X-Business-Id` are never platform grants. A platform-only operator receives no tenant operational permission; a user requiring both surfaces needs both independently reviewed memberships. Browser code sees no server key.

| API (relative to `/api/v1`)    | Permission / behavior                                                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /platform/me`             | Independent principal, read permissions and `readOnly:true`; no tenant context or email projection                                                                                                                    |
| `GET /platform/overview`       | `platform.overview.read`; current totals across all businesses, including disabled ones                                                                                                                               |
| `GET /platform/businesses`     | `platform.business.read`; page/limit ≤100, literal name search ≤120 chars, ACTIVE/DISABLED filter, allowlisted name/createdAt ordering with stable ID ties                                                            |
| `GET /platform/businesses/:id` | `platform.business.read`; approved metadata and aggregates for one business, 404 when absent                                                                                                                          |
| `GET /platform/audit`          | `platform.audit.read`; page/limit ≤100, reviewed action, target business UUID, from inclusive/until exclusive with UTC offset, createdAt/action sort and stable ID ties; default last 30 days, maximum range 366 days |
| `GET /platform/users`          | `platform.user.read`; unique profiles, literal display-name search ≤120 chars, profile status, business UUID, membership status filters; name/createdAt sort, page/limit ≤100                                         |
| `GET /platform/users/:id`      | `platform.user.read`; minimal profile plus independently paginated memberships (`page`/`limit`), 404 for absent profile                                                                                               |

Business projections contain name/status/timezone/currency/timestamps plus branches, membership rows, vehicles/rentals and current-assignment GPS freshness counts. Active membership requires both membership and profile ACTIVE; totals include disabled businesses, and membership counts are not globally unique people. GPS is always TEST and follows the existing 120/600-second thresholds. The API does not return user contacts, customer records, raw device identities, coordinates, history, notes or settings. Aggregations happen in SQL for the selected page/businesses, without browser tenant loops or per-tenant requests.

Every successful platform read locks and rechecks the operator/profile in the transaction that reads data and inserts `platform_audit_logs`; failed recheck or audit failure prevents delivery. Metadata records only a server request ID; targeted business/user IDs are separate fields with explicit entity types. Platform audit is independent of tenant `audit_logs`. The two platform tables have RLS enabled, no browser policies and all privileges revoked from PUBLIC/anon/authenticated, including for an authenticated platform operator. The API's trusted DB connection must still perform all platform authorization. There are no browser grants or platform administration writes.

The previous dedicated demo bootstrap is retired for configured named accounts; `platform:seed` refuses retired fixtures. Provision actual Superadmin access through an explicit trusted administrator process. The internal name `PLATFORM_OPERATOR` is kept for the existing platform DB/API boundary; the UI displays **Superadmin**. No self-service platform signup or platform write-management endpoint exists.

Audit returns only ID, actor UUID reference, allowlisted action/entity type, target UUID, timestamp and UUID-shaped server request ID; raw metadata is never returned. Unreviewed actions/entity types become `other`, unknown targets and malformed request IDs are omitted/null. A business filter matches only direct business-targeted platform events, never tenant audit. Viewing audit itself is audited after the returned snapshot. Filters use a fixed returned time window when paginating.

Users are registered application profiles, not an enumeration of Supabase Auth identities. Each list row counts one person regardless of tenant membership count. Support projection includes ID/display name/profile status, platform grant status, timestamps, Owner summary and membership counts. Detail memberships expose business ID/name/status and membership role/status only. `activeMembershipCount` requires profile, membership and business ACTIVE; this is deliberately stricter than Overview's active membership count, which includes disabled businesses. Contacts, Auth metadata, credentials, customers and raw telemetry are excluded. No impersonation, password reset, disabling or role-management actions are provided.

Features, Integrations and System Settings routes remain authorized but explicitly **unavailable**, with no live data contract or fake writes. Tenant suspension, entitlements, billing and account-management/support writes are not implemented. Development design previews remain a separate labelled surface and are excluded from production.

Focused authorization/migration verification:

```sh
pnpm --filter api exec vitest run src/platform/platform.spec.ts src/database/platform-migrations.spec.ts src/database/platform-seed-policy.spec.ts src/database/owner-role-migrations.spec.ts src/database/migrations.spec.ts
pnpm --filter api build
# Optional explicit real E2E: disposable fixture lifecycle, never personal accounts
pnpm --filter api exec vitest run --config vitest.config.e2e.ts test/platform.e2e-spec.ts
pnpm --filter web exec node --test test/auth-navigation.test.mjs
```

## Web brand and shared UI

Runtime identity uses the approved Canva **Rental Fleet OS** design `DAHY0Bey5gc`, page-1 mark asset `MAHY0DdEe94`, via `public/brand/mark.png` and Next `app/icon.png`. The transparent 199×172 PNG is Canva's provided asset rendition, displayed at 48px in the sidebar and 56px on Login (48px on mobile Login; 24px compact); no generated substitute or remote URL is required at runtime. The separate Identity design is not used. `BrandLockup` supplies the mark plus the verified Canva two-line wordmark **Rental Fleet / Operating System**, with accessible name Rental Fleet OS; Login has the English slogan/description while operational copy stays Vietnamese.

`styles/tokens.css` records the five verified Canva HEX colors. Other accessible tones/state colors are derived UI values. Shared Button (size/loading), controls/FormField, Panel/headers, badges, DataTable/Pagination, pressed-button Tabs, native-dialog Drawer (busy/Escape/focus return), Notice and loading/error/empty components live under `components/`. They carry presentation behavior only; tenant/platform API logic stays in features. Inter is self-hosted by `next/font/google` with Latin/Vietnamese subsets, `display: swap` and `--font-inter`; controls, overlays, maps and previews share the family. Body is 15px, navigation 16px, sidebar category labels 14px, forms/tables 14–15px, sections 17px and helper/badges 12px. Numbers use tabular figures. The centralized typed `Icon` aliases use pinned `lucide-react` named imports/stroke 2; sidebar icons increase from the observed 18px baseline to 20px. Brand artwork, chart and geographic paths are retained. Bright logo orange is retained as brand/accent; the verified deep orange supplies readable white-button backgrounds, with a derived darker hover.

## Fleet registry and assignment

`/app/vehicles`, `/app/vehicles/devices` and `/app/vehicles/:id` are live tenant-authorized pages. Vehicle lifecycle is `ACTIVE`/`INACTIVE`; rental availability and GPS freshness are independent derived concepts. A registry entry or assignment does not mean a tracker is online.

OWNER has `vehicle.read/manage` and `gps.read/manage`. Assign/end requires `vehicle.manage`. New branch associations require an active branch belonging to the verified tenant.

License plates are uppercased with whitespace/dot/hyphen removed, then validated as 4–16 ASCII letters/digits. The canonical plate is unique within the business, including inactive vehicles. GPS `provider` is lowercase and `deviceUid` trimmed but case-sensitive; `(provider, deviceUid)` is globally unique. Provider, UID and business ownership are immutable; PATCH changes only device label/status.

Each vehicle/device has at most one current primary assignment, enforced by partial unique indexes. Composite tenant foreign keys prevent mixed ownership. End the current assignment before disabling a resource or replacing its device. Assignment/end timestamps use `clock_timestamp()` after locking, with end bounded by assignment start. Ended history cannot be rewritten; there are no hard-delete or cross-business transfer APIs. Vehicles with RESERVED/ACTIVE rentals cannot be disabled.

All endpoints below are relative to `/api/v1` and require Supabase authentication plus verified tenant permission:

| Endpoint                                                  | Permission / behavior                              |
| --------------------------------------------------------- | -------------------------------------------------- |
| `GET /vehicles`, `GET /vehicles/:id`                      | `vehicle.read`; profiles and current assignment    |
| `POST /vehicles`, `PATCH /vehicles/:id`                   | `vehicle.manage`; profile/lifecycle                |
| `GET /gps-devices`                                        | `gps.read`; registry with available-device filter  |
| `POST /gps-devices`, `PATCH /gps-devices/:id`             | `gps.manage`; register or label/status update      |
| `GET /vehicles/:id/device-assignments`                    | `vehicle.read`; paginated history                  |
| `POST /vehicles/:id/device-assignments`                   | `vehicle.manage`; active unassigned device/vehicle |
| `POST /vehicles/:id/device-assignments/:assignmentId/end` | `vehicle.manage`; empty body only                  |

Lists use validated pagination, search/status, allowlisted sorting and stable ID ties; vehicles also filter branch, devices provider and `available=true`. UI device/customer/vehicle selection must paginate rather than silently cap choices at the first page. Fleet audit actions are `vehicle.create/update`, `gps_device.create/update` and `device_assignment.assign/end`.

## Customer and Rental Core

Live routes: `/app/customers`, `/app/customers/:id`, `/app/rentals`, `/app/rentals/new` and `/app/rentals/:id`. Dashboard schedule/active queue and Vehicle Detail current/next rental use real Rental API data. OWNER has `customer.read/manage` and `rental.read/manage`.

Customer names are trimmed, 1–120 characters; phone or email is required. Phone accepts 5–32 characters (digits, spaces/hyphens, optional leading `+`); email is trimmed/lowercase, maximum 254 characters. Contacts may be shared and are nonunique. Notes are at most 2,000 characters. Disable rather than hard-delete; a customer with RESERVED/ACTIVE rentals cannot be disabled. Historical rentals retain customer references.

Lifecycle: `DRAFT → RESERVED → ACTIVE → COMPLETED`; DRAFT/RESERVED may become CANCELLED. Handover records database time and `odometerStart`; return records database time and `odometerEnd`, at least the start reading. Odometers are integers 0–2,147,483,647. Invalid/repeated transitions conflict without duplicate milestones/audit events. `OVERDUE` is derived from ACTIVE + elapsed `endAt`, never stored as a workflow status. Vehicle display can be AVAILABLE/RESERVED/RENTED/OVERDUE without changing lifecycle or GPS status.

Drafts do not hold vehicles. Reserve requires an active vehicle/customer, unexpired interval and availability; handover is allowed only during the planned interval and while no other rental holds the vehicle. RESERVED/ACTIVE rentals block half-open UTC intervals `[startAt,endAt)`; adjacent reservations may share an endpoint. PostgreSQL GiST exclusion uses `btree_gist` in `extensions` to prevent overlap, plus a partial unique index permits only one ACTIVE rental per vehicle. An overdue unreturned vehicle remains unavailable after its old planned end. Existing future reservations stay visible but cannot hand over until the actual rental returns. Reserve/Extend recheck conflicts under the business lock.

| Endpoint                                          | Behavior                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET/POST /customers`, `GET/PATCH /customers/:id` | `customer.read/manage`; customer registry                                     |
| `GET/POST /rentals`, `GET/PATCH /rentals/:id`     | `rental.read/manage`; list/read/create draft/patch permitted fields           |
| `POST /rentals/:id/reserve`                       | `rental.manage`; empty body or `{}`                                           |
| `POST /rentals/:id/handover`                      | `rental.manage`; `{ odometerStart }`                                          |
| `POST /rentals/:id/extend`                        | `rental.manage`; `{ endAt, rentalAmount? }`, strictly later end               |
| `POST /rentals/:id/return`                        | `rental.manage`; `{ odometerEnd }`                                            |
| `POST /rentals/:id/cancel`                        | `rental.manage`; `{ notes? }` optionally replaces notes                       |
| `GET /vehicles/availability`                      | Required `startAt/endAt`; pagination/search/branch/available-only and reasons |
| `GET /vehicles/:id/rental-state`                  | Current/next rental and derived vehicle display state                         |

Draft PATCH may change customer/vehicle/interval/amounts/deposit/notes. RESERVED/ACTIVE PATCH changes amounts/deposit/notes only; interval extension uses the action endpoint. Terminal rentals are read-only. Amounts are JSON numbers 0–999,999,999.99 with at most two decimal places, stored as exact `numeric(14,2)`. Currency follows Business settings. `depositRequiredAmount` and `depositReceived` are simple fields, not payment/refund/reconciliation ledgers. Rental lists filter status/customer/vehicle/overdue and paginate on the server. Forms use generated contracts; a vehicle choice is advisory until reserve rechecks it.

## GPS ingestion and current location

The only verified source is a **Traccar TEST feed** through its real decoder, authenticated ingestion, database and API. Adapter/storage/UI fix `sourceMode: TEST`; input cannot promote it to REAL. Feed coordinates are synthetic. No physical tracker, durable external provider or production deployment is verified.

`POST /api/v1/integrations/traccar/positions` accepts the Traccar JSON forwarding envelope (`device`, `position`). Set server-only `GPS_TRACCAR_TOKEN` to at least 32 random characters in the ignored API env; an empty/short value disables ingestion with `GPS_NOT_CONFIGURED`. Traccar sends `X-Traccar-Token`; constant-time hash comparison rejects missing/incorrect credentials with `INVALID_GPS_TOKEN`. This trusted webhook credential is separate from Supabase user auth and never reaches browser env or logs.

Webhook-only controls authenticate before JSON parsing, accept uncompressed JSON up to **16 KiB**, and reject invalid JSON/media/encoding with secret-safe 400/413/415 envelopes. Other API routes retain Nest's normal body-parser settings. Limits are **600 requests / 60 seconds per process**, **120 valid packets / device / window**, **16 concurrent ingress requests**, and at most **1,024 hashed identity buckets** cleared each window. Rejected authentication attempts consume the global quota. Quota errors return 429 `GPS_RATE_LIMITED` with `Retry-After` (1–60 seconds); semantic duplicates still consume capacity and remain idempotent in storage. Provider retries must honor the delay. These fixed-window, process-local controls are not a distributed quota or durable queue.

A `gps_ingress_window` structured event reports only fixed aggregate outcome counters when the next request advances a 60-second window. It contains no raw UID, IP, coordinates, body or token; `LOG_REQUESTS=false` disables these logs. Before external provider exposure, configure gateway per-source connection limits and a shorter body/read timeout: Node's current request deadline is five minutes, so slow authenticated bodies can occupy the bounded ingress slots until then. No external gateway/provider deployment is enabled automatically.

The adapter maps only canonical fields, not raw provider packets:

| Field                       | Validation/source                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `provider`, `deviceUid`     | Fixed `traccar`; case-sensitive `device.uniqueId`                                                           |
| `recordedAt`, `receivedAt`  | Strict timezone-qualified `position.fixTime`; database clock on first receipt                               |
| `latitude`, `longitude`     | Finite numeric degrees in −90…90 and −180…180                                                               |
| `speedKph`, `heading`       | Knots ×1.852, finite 0…600 km/h; course finite 0 ≤ degrees <360                                             |
| `ignition`                  | Boolean `position.attributes.ignition`, null when absent                                                    |
| `sourceEventId`, `eventKey` | Optional positive safe-integer provider ID; SHA-256 of UID/fix/coordinates/normalized speed/course/ignition |
| `sourceMode`                | Server-fixed/database-constrained `TEST`                                                                    |

Only `position.valid === true` is accepted. Invalid values return `INVALID_TELEMETRY`; fixes more than five minutes ahead of database time or more than 30 days old return `GPS_TIME_OUTSIDE_WINDOW`. Global immutable registry identity resolves the business; incoming business/vehicle IDs are ignored. Under the business lock, ingestion checks active business/device and exactly one historical assignment containing `recordedAt` in `[assignedAt,unassignedAt)`. This includes ended assignments for delayed events; unresolved/ambiguous assignments are rejected. Composite `(businessId,assignmentId,deviceId,vehicleId)` ownership is enforced by a foreign key.

Unique `(deviceId,eventKey)` makes semantic retransmissions idempotent. Traccar memory-store IDs restart and are diagnostic only. Duplicates return the original position ID and `duplicate:true`, without changing first receipt time. Current location is the latest point of the current assignment ordered by `recordedAt DESC, receivedAt ASC, id ASC`, backed by `gps_positions_assignment_latest`; delayed points cannot move it backwards and equal-time ties retain the first accepted point. Ending/replacing an assignment immediately hides its old points from current location while preserving history. Device/vehicle time, retention and assignment identity indexes support the other access paths.

`GET /vehicles/:id/location` returns a scoped current projection or 404; `GET /fleet/locations` returns scoped paginated projections, optional `search/state`, tenant statistics, `asOf` and `pollAfterSeconds:20`. Both require `gps.read`. An active rental ID is exposed only with `rental.read`. Registry permissions and assignment do not establish a GPS signal:

| State        | Recorded fix age against server time                    |
| ------------ | ------------------------------------------------------- |
| `UNASSIGNED` | No current assignment                                   |
| `NO_DATA`    | Current assignment has no accepted fix                  |
| `FRESH`      | ≤120 seconds                                            |
| `STALE`      | >120 and ≤600 seconds                                   |
| `OFFLINE`    | >600 seconds; last-known coordinates may remain visible |

`GET /fleet/telemetry/diagnostics` requires `gps.read` and returns only the selected tenant's freshness counts and unique stored fixes/devices received in the last 15 minutes, last received/recorded times, `sourceMode:TEST`, ingestion-enabled state and fixed process limits. Duplicate requests do not increase stored-fix counts or change first receipt time. The response exposes no device/vehicle IDs, coordinates, credentials or cross-tenant failure counters; failure categories remain in aggregate internal logs.

`/app/fleet-map`, dashboard GPS and Vehicle Detail use these authorized projections with explicit **TEST FEED** labels. The live map plots/lists its current page of 20 vehicles, with vehicle/current-rental navigation. It polls 20 seconds after completion, pauses hidden tabs and aborts obsolete work on unmount/filter/tenant changes. Failed refresh retains the last response with a warning, last successful load time and an explicit retry button; 401/403 navigate to Login/access denied. STALE/OFFLINE descriptions identify coordinates as last recorded rather than confirmed current position. Vehicle Detail refreshes on page reload; history is not polled or downloaded by the current-location map.

Leaflet 1.9.4 loads client-side and uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible attribution. Tile failure preserves the list/coordinates. Public OSM tiles are best-effort: retain Referer/caching behavior and attribution, with no bulk downloading/prefetch. Higher-volume deployments need an appropriate tile service. References: [Leaflet](https://leafletjs.com/reference.html), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## TEST feed and retention commands

Use only development project `eeryymswcufnebibigqf`, a migrated database, running Docker/API on `127.0.0.1:9000`, configured token and a registered `traccar` device with unique `TEST-` UID assigned to a disposable vehicle:

```sh
pnpm --filter api gps:poc --uid=TEST-your-unique-device
pnpm --filter api gps:retention --business=<verified-tenant-uuid> --dry-run --batch-limit=1000
pnpm --filter api gps:retention --business=<verified-tenant-uuid> --apply --batch-limit=1000 --max-batches=3
pnpm --filter api gps:retention --help
pnpm --filter api gps:plans
pnpm --filter api gps:retention:verify
```

The PoC command refuses another environment/project or ambiguous assignment. It launches a unique official Traccar 6.16.0 Docker container pinned to a digest, with memory storage, OsmAnd only and loopback port **5055**. Its temporary XML token config is mode 0600 and never printed. Port conflicts fail without stopping/reusing another container. On macOS Docker Desktop forwarding uses `host.docker.internal:9000`; check routing/API/token if canonical verification fails. No remote provider listener is deployed.

Synthetic OsmAnd packets pass through Traccar JSON forwarding and canonical ingestion; the script checks 12 knots →22.224 km/h, semantic duplicates and delayed fix ordering. Per-run timestamps allow repeated use of a TEST UID. Its non-secret JSON output is terminal evidence, not a generated repository report. Idempotent cleanup removes its own container/config on completion/failure/SIGINT/SIGTERM; stored points remain on the chosen assignment until owned-data cleanup or retention. References: [Traccar forwarding](https://www.traccar.org/forward/), [forwarder-only configuration](https://www.traccar.org/forwarder-only/), [pinned speed units](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/model/Position.java).

History expires **30 days after receivedAt**, except the latest point of each active assignment remains as its last-known location, even after 30 days offline. Ended assignments have no exception. This is distinct from ingestion's recorded-time acceptance window. Retention is development-only and requires one explicit tenant. Default dry-run selects one bounded page without deleting. `--batch-limit` is 1–1,000 (default 1,000); `--max-batches` is 1–10 (default 1), used only with explicit `--apply`, so one invocation deletes at most 10,000 rows. Each applied batch locks the same Business row as ingestion/assignment writes before selecting and deleting; it uses a database-clock cutoff, 2-second lock timeout, 10-second statement timeout and actual deleted row counts. Failures produce a redacted event and nonzero exit. A future scheduler may invoke this one-shot bounded command with an explicit tenant; no staging/production cron or automatic scheduler is installed. Review dry-run before any deliberate apply. `gps:plans` measures existing public queries read-only and synthetic temporary indexed tables inside a rollback; `gps:retention:verify` uses exact owned disposable fixtures to verify real PostgreSQL locking/isolation, then removes them. Both commands refuse other projects/environments. Historical Trip results can become partial or disappear as points expire.

## Derived Trip history and route replay

Trips are calculated on demand from existing `gps_positions`; there is no duplicate history table, persisted summary or new migration. OWNER receives `trip.read`; the same active-profile/business/membership guards and tenant predicates protect every Trip/filter/detail/route query. An opaque Trip ID is not an authorization credential. GPS ingestion and current-location selection remain separate and unchanged.

| Endpoint               | Query / response boundary                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /trips`           | Optional `vehicleId`, `rentalId`, `from`, `to`, `sort=asc/desc` (default desc), standard page/limit; default last 24 hours |
| `GET /trips/:id`       | One rederived summary in its original exact query window                                                                   |
| `GET /trips/:id/route` | Recorded points with page/limit; default and maximum 500 points per page, `total` and `hasMore`                            |

Ranges use `[from,to)`, require timezone-qualified timestamps, increase strictly and span at most **7 days**, with end no later than five minutes ahead. At most **10,000 candidate fixes** may be considered before trip-list pagination; denser ranges fail with 422 `TRIP_POINT_LIMIT` and must be narrowed. Invalid ranges/IDs return 400 `INVALID_TRIP_RANGE` / `INVALID_TRIP_ID`; unavailable or cross-tenant filter/detail resources return 404 `TRIP_NOT_FOUND`. Empty data is a valid empty list. Route paging bounds transfers rather than silently truncating server derivation.

Derivation sorts by recorded time, with first `receivedAt`/ID canonicalizing duplicate assignment/timestamp fixes. It uses each point's historical assignment resolved at ingestion, never today's device assignment. SQL selection and domain derivation both revalidate `recordedAt` within `[assignedAt,unassignedAt)`; a clock-skew-tolerated fix dated after its assignment later ended is excluded rather than attributed to another assignment. Assignment changes always split; gaps over **10 minutes** split without connecting a line. `ignition=false` with speed below **3 km/h** closes a segment. Movement requires a fix at least 3 km/h or a usable consecutive edge of at least **30 metres**; stationary-only groups are omitted. Consecutive Haversine distances are estimates, not odometer readings. Edges implying more than **250 km/h** are excluded from distance and carry `breakBefore:true` so replay never draws across the jump.

Each summary includes vehicle/assignment/device identity, optional inferred rental ID, UTC start/end and duration, estimated distance, point count, recorded/received freshness, `sourceMode:TEST`, `derivation:DERIVED`, `distanceKind:ESTIMATED`, route availability and partial reasons. A single moving fix stays a partial Trip with `INSUFFICIENT_POINTS` and no usable route. Unobserved starts/ends, gaps, assignment boundaries, conflicting ignition/movement, implausible position jumps and a query before the 30-day retention boundary are explicit limitations (`START_NOT_OBSERVED`, `END_NOT_OBSERVED`, `GAP_BEFORE/AFTER`, `ASSIGNMENT_BOUNDARY`, `IGNITION_CONFLICT`, `POSITION_JUMP`, `RETENTION_WINDOW`). `RANGE_START` additionally marks a segment whose assignment began before the query window without an observed preceding stop; the API does not claim that its first returned fix is the actual departure. Freshness uses the same 120/600-second recorded-time thresholds as current location and does not make historical replay live tracking.

Rental associations use tenant/vehicle-matching scheduled windows of RESERVED/ACTIVE/COMPLETED rentals. `CONTAINED` means the full derived segment fits the scheduled interval; `OVERLAP` means only a time intersection. Both carry `basis:SCHEDULED_WINDOW` and do not prove actual customer use. A scalar `rentalId` is set only for exactly one containing interval; the association list preserves overlaps. Filtering by Rental uses these associations without inventing a route across a boundary.

IDs encode the vehicle, start-fix ID and exact normalized query window, then detail/route rederive with authorization. Late fixes can change grouping or IDs; retention can remove a Trip or make it partial. Refresh the list when a saved detail returns unavailable. The not-found/error recovery link restores the encoded Vehicle/time filters after validation; these are untrusted navigation hints, and every resulting API request is authorized again. Malformed encoded IDs are shown as unavailable rather than a generic server error. Partial reasons describe observable limits; missing packets cannot be reconstructed.

`/app/trips` uses this live API with Vehicle/Rental/date filters and detail replay; Vehicle/Rental detail link to the corresponding filtered history. Leaflet replay draws only received bounded route points, honors line breaks and provides start/end markers and simple scrub/step controls. It does not poll history or fabricate missing points. Synthetic Trip examples stay under development-only previews.

## Web UI and preview boundaries

Live `/app` features use generated API contracts, verified tenant context and shared semantic tokens/components. `apps/web/src/styles/tokens.css` defines the orange/gray/white system: Inter body 15px/1.55, navigation 16px, category labels 14px, forms/tables 14–15px, sections 17px, page titles 28px, helpers/badges 12px. Use semantic/component styles rather than global zoom/transforms. Native dialogs provide labelled titles, Escape/focus containment and restored trigger focus; notices use alert/status regions. Status includes text, not color alone. Tables scroll within panels; navigation collapses and map/list adapts on smaller screens. For an implementation stage, verify changed UI paths only as needed; defer exhaustive viewport/visual matrices and comprehensive accessibility checks to Final Validation. No screenshots by default.

Login retains Supabase `signInWithPassword`, pending/error feedback, SSR cookies and business-cookie reset. A valid explicit `next` stays unchanged; generic login selects `/app` or `/superadmin` from the independent NestJS grant checks described above. A competing refresh can race navigation, so do not add an immediate router refresh after login. Preserve the same shared design tokens and components.

The shared shell puts BusinessSwitcher in the tenant topbar and an explicit Platform Console label in the platform topbar. The verified current account email is the primary UserAccountMenu label with its role beneath. Its refined trigger uses an accent avatar, bounded email/role and expanded chevron; the 320px popover separates account identity/role from grouped icon actions and clamps its measured content to the viewport. Its actions are exactly Dark Mode → Cài đặt → divider → Đăng xuất; Settings/Logout are absent from the sidebar. Owner Settings remains the existing tenant route; platform Settings remains explicitly unavailable behind its existing platform authorization. Sidebar width is 372px at desktop widths ≥1440px, 280px at 1101–1439px, 248px at 1024–1100px, and a bounded overlay below 1024px. The application frame fills the viewport: sidebar/logo and topbar stay fixed while only the labelled workspace content region (including its footer) scrolls. Login and other standalone routes retain ordinary document scrolling. Route path changes reset the content position; query-only filter/pagination transitions preserve it. The logo has its own surface and divider aligned with the topbar. Sidebar menu-row padding is 13.5px × 18px (50% above 9px × 12px), with 12px × 18px category headers; the sidebar create action is removed. At viewport heights ≤960px, navigation categories act as an accessible accordion, defaulting to the current route group. Menu-only overflow is an accessibility fallback for unusually short windows, while the logo and bottom action stay fixed. Business selection only accepts a supplied membership ID and reloads the document; NestJS revalidates the active membership and all tenant queries remain scoped.

Light/dark theme uses semantic CSS variables derived from the approved palette. A small synchronous root-head initializer applies the allowlisted local `rental-fleet-theme` preference before content paint, or follows system theme when unset; storage failure falls back to system. ThemeSync follows system/storage changes across every route. This local preference never writes business settings or changes authorization. Both themes preserve readable text/status/primary-button contrast; Leaflet controls inherit the theme while geographic tiles retain original colors.

Initial loading boundaries reserve dashboard/list/detail/map shapes inside persistent protected layouts. Same-tenant query navigation uses transitions, retained panel identities and scroll preservation, with reserved inline pending status and disabled conflicting page actions. RecordPicker retains only matching business/path snapshots, marks errors/stale results and supports retry/abort; GPS polling preserves its existing cancellation/visibility rules and freshness labels. Full tenant switching still reloads the document and removes previous tenant state.

Shared `components/ui/controls.tsx` supplies SearchField, FilterBar, native DateInput and an accessible searchable Combobox with a viewport-bounded portal, keyboard selection and outside/Escape close. Compact form selects stay native; server-backed RecordPicker retains explicit search and pagination. Vehicles/Devices, Rentals, Customers, Trips and platform Businesses/Users/Audit reuse the filter pattern. Clear resets native/custom draft controls before applying default filters. `styles/component-system.css` aligns control heights and shared states; shell/brand styles remain separate presentation modules.

Only `next dev` exposes `/dev-preview/business` and `/dev-preview/platform`, with clearly labelled historical synthetic fixtures; those preview routes return 404 in production. Commercial remains a tenant development preview. Live `/superadmin/*` uses its independent protected platform layout/API and never imports fixture modules. Unimplemented live platform sections display unavailable states. Server checks must happen before importing any development fixtures; a tenant OWNER is never implicitly a platform principal. There is no production flag to enable synthetic screens. Existing tenant operational preview wrappers still pass the tenant layout/proxy.

Future platform management/support features must extend the independent principal/permissions, server/API guards and separate redacted audit rather than bypassing them. Never iterate tenant IDs from the browser, expose server keys or grant global access through `user_metadata`. Commercial/payment/accounting, geofences/alerts and physical GPS production onboarding remain outside current scope. Production GPS also needs durable deployment, credential rotation/rate limiting, monitoring, scheduled retention and map capacity planning.

Production release-boundary regression uses unauthenticated localhost requests against a temporary production server:

```sh
pnpm --filter web build
# Stop dev first; start only with authorization, then stop this temporary server.
pnpm --filter web start --hostname 127.0.0.1
UI_TEST_BASE_URL=http://localhost:4000 node --test apps/web/test/preview-boundaries.mjs
```

If the sandbox blocks Turbopack's internal CSS-worker port, `pnpm --filter web exec next build --webpack` can verify output without changing the pinned Next.js/default build script. Read the installed guides in `apps/web/node_modules/next/dist/docs/` before changing Next.js APIs; this installed version has breaking changes.

## Staging

Use an independent Supabase project with the same migrations and ignored root `.env.staging.api` / `.env.staging.web`, based on app examples. Set `APP_ENV=staging`, HTTPS `WEB_ORIGIN`, public API/Supabase URLs and staging database credentials. Do not run demo seed or development verification against it.

```sh
docker compose --env-file .env.staging.web -f compose.staging.yaml up --build -d
docker compose --env-file .env.staging.web -f compose.staging.yaml down
```

Docker has separate api/web targets: Web 4000, API 9000. `NEXT_PUBLIC_*` are public build arguments; secrets stay runtime-only and excluded from the build context. Use an HTTPS reverse proxy over loopback-bound ports and configure Supabase Auth Site URL/redirect allowlist for that Web origin. No staging project/deployment is created automatically. [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) requires a paid plan and is unavailable on the current Free project.

## Stage output and historical records

Root [STAGE_OUTPUT.md](../STAGE_OUTPUT.md) is the sole permanent accumulated implementation log for every stage. Never delete it. Append chronological `## Stage N output` sections containing actual Delivered work, Minimal Verification, Boundaries & Remaining, and Next-stage Handoff. Include meaningful API/UI/data behavior, LIVE/TEST/PREVIEW distinctions, exact checks/results, limitations and commit references in the same implementation commit; describe it as "this stage's implementation commit" or use the stage identifier and baseline SHA. The Git log is authoritative for its resulting SHA: exactly one implementation commit must include source, migrations/contracts/tests, rule changes and completed output. Never add another commit or amend solely to record the final SHA. Historical results are recorded facts, not claims that old checks were rerun now; mark missing evidence as not verified.

Input stage plans remain task inputs and must not become permanent individual stage reports or copied repository Markdown. Do not create substitute per-stage logs, validation/architecture/recap Markdown, QA JSON manifests or screenshots by default. Visual evidence requires an explicit user request or plan requirement; keep temporary test output outside tracked source. Necessary runtime source, tests, migrations and generated contracts remain allowed.

Older detailed outputs and removed evidence remain retrievable through Git: `git show 85d4f2b:STAGE_OUTPUT.md` recovers the original through-Stage-5 log; `git show a5395ed -- docs` recovers the final Stage 6 output. Current operating policy is consolidated in this runbook. Root/Web AGENTS instructions are maintained manually. `agentRules: false` in `apps/web/next.config.ts` disables automatic agent-file generation; keep the required installed Next.js documentation rule in Web AGENTS without adding instruction shims.
