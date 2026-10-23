# Development

## Run and verify

Use pnpm 11.19.0; project scripts select Node 24.21.0. Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/api/.env.example` to `apps/api/.env` on a new checkout. Supply real values locally only.

```sh
pnpm install --frozen-lockfile
pnpm dev                 # Web :4000, API :9000; Ctrl+C stops both
pnpm build
pnpm lint
pnpm typecheck
pnpm test                # domain/security tests and clean-database migration replay
pnpm test:e2e            # real dev Auth/API/RLS tests; requires demo seed
pnpm openapi             # after API build; exports spec and generated types
```

Local Web: `http://localhost:4000` (fixed by both `dev` and `start` scripts). Local API: `http://127.0.0.1:9000`; `WEB_ORIGIN=http://localhost:4000`. Keep local env files aligned with their examples, including `NEXT_PUBLIC_API_BASE_URL`. These ports belong to this Rental project; do not stop another project's listener when a conflict occurs.

API prefix: `/api/v1`. Swagger: `/api/docs`; JSON: `/api/openapi.json` (disabled in production). Errors contain `statusCode`, `code`, `message`, `requestId`, without database/provider details. Standard lists accept `page` (default 1) and `limit` (default 20, maximum 100), with stable ID tie-breaking. Dates use explicit UTC offsets and API output is UTC ISO; the UI formats operational times in `Asia/Ho_Chi_Minh`.

Ask before starting a server unless the user has already authorized it for the task. Record owned sessions/PIDs/ports; stop temporary servers, watchers and containers on completion/failure and verify they exited. Retain dev servers only when the user requests it. Never stop unrelated/user-owned processes or use broad kill commands.

## Database and demo login

Drizzle is the query layer. SQL migrations in `supabase/migrations` are the sole schema source of truth; `apps/api/src/database/schema.ts` maps the query types. Create files with `supabase migration new descriptive_name`, test with `pnpm test`, then `pnpm db:migrate`. The migration command checks `SUPABASE_PROJECT_REF` against `SUPABASE_URL`, links that project and uses Supabase migration history. Supabase CLI must be installed and authenticated. Preview with `pnpm --filter api db:migrate --dry-run`.

`DATABASE_URL` is the PostgreSQL URI from Connect → Session pooler, with a URL-encoded password and no placeholder brackets. The client verifies TLS using `infra/certs/supabase-ca.crt` (public CA downloaded from the Dashboard); override `DATABASE_CA_PATH` if another CA is required. Never disable certificate/hostname verification. Idle pool errors log only a redacted event/type, never the connection/client or error message.

Only development project **eeryymswcufnebibigqf** may be seeded or used for demo/E2E/GPS maintenance. Set `APP_ENV=development`, `ALLOW_DEMO_SEED=true` and a working server key in `SUPABASE_SECRET_KEY`, then run `pnpm db:seed`. Seed creates two disposable demo businesses and role-specific Auth users without email; it is repeatable and does not reset existing users/data. Login details live only in ignored root `.env.demo.json`; `accounts.ownerA.email/password` supplies the owner login. Never print or commit this file, real env files, tokens or server keys.

Production users are created in Supabase Auth by an administrator. An OWNER/ADMIN adds the known Auth User ID through membership management; there is no automatic email invite. Only OWNER can assign elevated roles. Do not seed, reset or run development tests against staging/production.

E2E suites run serially because SaaS Core exercises revocation of shared demo accounts. Suites/QA must record exact disposable IDs and clean only those domain records, in dependency order, while retaining audit events. Never delete by wildcard or remove existing tenant data.

## Architecture and security

- Web uses per-request Supabase SSR clients, cookie refresh in `proxy.ts` and protected server layouts. It forwards bearer tokens to NestJS; browser code receives only the publishable key. A business switch reloads the document so prior tenant form/list/map state cannot survive.
- NestJS verifies Supabase Auth, then active profile, business and membership. Optional `X-Business-Id` selects a verified active membership; otherwise the oldest active membership is selected. Never authorize with `user_metadata`, a browser-supplied business ID, hidden menu or frontend state.
- OWNER manages all roles; ADMIN manages operational memberships/business/branches/settings and Fleet/Customer/Rental writes. OPERATIONS reads business/branches/settings, vehicles/devices, customers/rentals/availability and authorized telemetry/trips. The last active owner cannot be demoted or disabled. Backend guards enforce permissions independently of the UI.
- Every resource query includes the verified business ID. Mutations acquire the business row lock, recheck current profile/business/membership/permission and write the resource and audit event in one transaction. Membership revocation and domain writes share that lock. Unique/exclusion constraints provide a second concurrency defense.
- Audit metadata contains request IDs and changed field names, not bodies, coordinates, tracker identifiers, credentials, contacts, notes or amounts. Wrapped database errors map to stable public conflict codes.
- Exposed tables enable RLS. Tenant registry/customer/rental Data API reads require active membership/profile/business; direct writes by `anon`/`authenticated` are revoked. `gps_positions` denies all Data API reads and writes, with RLS enabled and no read policy. The API's trusted database connection still must enforce tenant authorization itself. No `SECURITY DEFINER` authorization helper is used.
- Generated OpenAPI and TypeScript contracts live in `packages/contracts`; regenerate after API changes. Database schema, credentials and provider secrets remain server-only.

Domain boundaries are `apps/api/src/fleet/vehicles`, `apps/api/src/rentals` and `apps/api/src/telematics/{gps,trips}`. Web live features follow `features/fleet/vehicles`, `features/rentals` and `features/telematics/{gps,trips}`; synthetic business examples live in `features/previews/business`, and platform preview code stays under `features/platform`. Shared UI/data-display/overlay components contain presentation behavior rather than tenant business rules. Routes and API payloads remain stable during structural moves.

## Fleet registry and assignment

`/app/vehicles`, `/app/vehicles/devices` and `/app/vehicles/:id` are live tenant-authorized pages. Vehicle lifecycle is `ACTIVE`/`INACTIVE`; rental availability and GPS freshness are independent derived concepts. A registry entry or assignment does not mean a tracker is online.

OWNER/ADMIN have `vehicle.read/manage` and `gps.read/manage`; OPERATIONS has `vehicle.read` and `gps.read`. Assign/end requires `vehicle.manage`. New branch associations require an active branch belonging to the verified tenant.

License plates are uppercased with whitespace/dot/hyphen removed, then validated as 4–16 ASCII letters/digits. The canonical plate is unique within the business, including inactive vehicles. GPS `provider` is lowercase and `deviceUid` trimmed but case-sensitive; `(provider, deviceUid)` is globally unique. Provider, UID and business ownership are immutable; PATCH changes only device label/status.

Each vehicle/device has at most one current primary assignment, enforced by partial unique indexes. Composite tenant foreign keys prevent mixed ownership. End the current assignment before disabling a resource or replacing its device. Assignment/end timestamps use `clock_timestamp()` after locking, with end bounded by assignment start. Ended history cannot be rewritten; there are no hard-delete or cross-business transfer APIs. Vehicles with RESERVED/ACTIVE rentals cannot be disabled.

All endpoints below are relative to `/api/v1` and require Supabase authentication plus verified tenant permission:

| Endpoint | Permission / behavior |
| --- | --- |
| `GET /vehicles`, `GET /vehicles/:id` | `vehicle.read`; profiles and current assignment |
| `POST /vehicles`, `PATCH /vehicles/:id` | `vehicle.manage`; profile/lifecycle |
| `GET /gps-devices` | `gps.read`; registry with available-device filter |
| `POST /gps-devices`, `PATCH /gps-devices/:id` | `gps.manage`; register or label/status update |
| `GET /vehicles/:id/device-assignments` | `vehicle.read`; paginated history |
| `POST /vehicles/:id/device-assignments` | `vehicle.manage`; active unassigned device/vehicle |
| `POST /vehicles/:id/device-assignments/:assignmentId/end` | `vehicle.manage`; empty body only |

Lists use validated pagination, search/status, allowlisted sorting and stable ID ties; vehicles also filter branch, devices provider and `available=true`. UI device/customer/vehicle selection must paginate rather than silently cap choices at the first page. Fleet audit actions are `vehicle.create/update`, `gps_device.create/update` and `device_assignment.assign/end`.

## Customer and Rental Core

Live routes: `/app/customers`, `/app/customers/:id`, `/app/rentals`, `/app/rentals/new` and `/app/rentals/:id`. Dashboard schedule/active queue and Vehicle Detail current/next rental use real Rental API data. OWNER/ADMIN have `customer.read/manage` and `rental.read/manage`; OPERATIONS has the two read permissions.

Customer names are trimmed, 1–120 characters; phone or email is required. Phone accepts 5–32 characters (digits, spaces/hyphens, optional leading `+`); email is trimmed/lowercase, maximum 254 characters. Contacts may be shared and are nonunique. Notes are at most 2,000 characters. Disable rather than hard-delete; a customer with RESERVED/ACTIVE rentals cannot be disabled. Historical rentals retain customer references.

Lifecycle: `DRAFT → RESERVED → ACTIVE → COMPLETED`; DRAFT/RESERVED may become CANCELLED. Handover records database time and `odometerStart`; return records database time and `odometerEnd`, at least the start reading. Odometers are integers 0–2,147,483,647. Invalid/repeated transitions conflict without duplicate milestones/audit events. `OVERDUE` is derived from ACTIVE + elapsed `endAt`, never stored as a workflow status. Vehicle display can be AVAILABLE/RESERVED/RENTED/OVERDUE without changing lifecycle or GPS status.

Drafts do not hold vehicles. Reserve requires an active vehicle/customer, unexpired interval and availability; handover is allowed only during the planned interval and while no other rental holds the vehicle. RESERVED/ACTIVE rentals block half-open UTC intervals `[startAt,endAt)`; adjacent reservations may share an endpoint. PostgreSQL GiST exclusion uses `btree_gist` in `extensions` to prevent overlap, plus a partial unique index permits only one ACTIVE rental per vehicle. An overdue unreturned vehicle remains unavailable after its old planned end. Existing future reservations stay visible but cannot hand over until the actual rental returns. Reserve/Extend recheck conflicts under the business lock.

| Endpoint | Behavior |
| --- | --- |
| `GET/POST /customers`, `GET/PATCH /customers/:id` | `customer.read/manage`; customer registry |
| `GET/POST /rentals`, `GET/PATCH /rentals/:id` | `rental.read/manage`; list/read/create draft/patch permitted fields |
| `POST /rentals/:id/reserve` | `rental.manage`; empty body or `{}` |
| `POST /rentals/:id/handover` | `rental.manage`; `{ odometerStart }` |
| `POST /rentals/:id/extend` | `rental.manage`; `{ endAt, rentalAmount? }`, strictly later end |
| `POST /rentals/:id/return` | `rental.manage`; `{ odometerEnd }` |
| `POST /rentals/:id/cancel` | `rental.manage`; `{ notes? }` optionally replaces notes |
| `GET /vehicles/availability` | Required `startAt/endAt`; pagination/search/branch/available-only and reasons |
| `GET /vehicles/:id/rental-state` | Current/next rental and derived vehicle display state |

Draft PATCH may change customer/vehicle/interval/amounts/deposit/notes. RESERVED/ACTIVE PATCH changes amounts/deposit/notes only; interval extension uses the action endpoint. Terminal rentals are read-only. Amounts are JSON numbers 0–999,999,999.99 with at most two decimal places, stored as exact `numeric(14,2)`. Currency follows Business settings. `depositRequiredAmount` and `depositReceived` are simple fields, not payment/refund/reconciliation ledgers. Rental lists filter status/customer/vehicle/overdue and paginate on the server. Forms use generated contracts; a vehicle choice is advisory until reserve rechecks it.

## GPS ingestion and current location

The only verified source is a **Traccar TEST feed** through its real decoder, authenticated ingestion, database and API. Adapter/storage/UI fix `sourceMode: TEST`; input cannot promote it to REAL. Feed coordinates are synthetic. No physical tracker, durable external provider or production deployment is verified.

`POST /api/v1/integrations/traccar/positions` accepts the Traccar JSON forwarding envelope (`device`, `position`). Set server-only `GPS_TRACCAR_TOKEN` to at least 32 random characters in the ignored API env; an empty/short value disables ingestion with `GPS_NOT_CONFIGURED`. Traccar sends `X-Traccar-Token`; constant-time hash comparison rejects missing/incorrect credentials with `INVALID_GPS_TOKEN`. This trusted webhook credential is separate from Supabase user auth and never reaches browser env or logs.

The adapter maps only canonical fields, not raw provider packets:

| Field | Validation/source |
| --- | --- |
| `provider`, `deviceUid` | Fixed `traccar`; case-sensitive `device.uniqueId` |
| `recordedAt`, `receivedAt` | Strict timezone-qualified `position.fixTime`; database clock on first receipt |
| `latitude`, `longitude` | Finite numeric degrees in −90…90 and −180…180 |
| `speedKph`, `heading` | Knots ×1.852, finite 0…600 km/h; course finite 0 ≤ degrees <360 |
| `ignition` | Boolean `position.attributes.ignition`, null when absent |
| `sourceEventId`, `eventKey` | Optional positive safe-integer provider ID; SHA-256 of UID/fix/coordinates/normalized speed/course/ignition |
| `sourceMode` | Server-fixed/database-constrained `TEST` |

Only `position.valid === true` is accepted. Invalid values return `INVALID_TELEMETRY`; fixes more than five minutes ahead of database time or more than 30 days old return `GPS_TIME_OUTSIDE_WINDOW`. Global immutable registry identity resolves the business; incoming business/vehicle IDs are ignored. Under the business lock, ingestion checks active business/device and exactly one historical assignment containing `recordedAt` in `[assignedAt,unassignedAt)`. This includes ended assignments for delayed events; unresolved/ambiguous assignments are rejected. Composite `(businessId,assignmentId,deviceId,vehicleId)` ownership is enforced by a foreign key.

Unique `(deviceId,eventKey)` makes semantic retransmissions idempotent. Traccar memory-store IDs restart and are diagnostic only. Duplicates return the original position ID and `duplicate:true`, without changing first receipt time. Current location is the latest point of the current assignment ordered by `recordedAt DESC, receivedAt ASC, id ASC`, backed by `gps_positions_assignment_latest`; delayed points cannot move it backwards and equal-time ties retain the first accepted point. Ending/replacing an assignment immediately hides its old points from current location while preserving history. Device/vehicle time, retention and assignment identity indexes support the other access paths.

`GET /vehicles/:id/location` returns a scoped current projection or 404; `GET /fleet/locations` returns scoped paginated projections, optional `search/state`, tenant statistics, `asOf` and `pollAfterSeconds:20`. Both require `gps.read`. An active rental ID is exposed only with `rental.read`. Registry permissions and assignment do not establish a GPS signal:

| State | Recorded fix age against server time |
| --- | --- |
| `UNASSIGNED` | No current assignment |
| `NO_DATA` | Current assignment has no accepted fix |
| `FRESH` | ≤120 seconds |
| `STALE` | >120 and ≤600 seconds |
| `OFFLINE` | >600 seconds; last-known coordinates may remain visible |

`/app/fleet-map`, dashboard GPS and Vehicle Detail use these authorized projections with explicit **TEST FEED** labels. The live map plots/lists its current page of 20 vehicles, with vehicle/current-rental navigation. It polls 20 seconds after completion, pauses hidden tabs and aborts obsolete work on unmount/filter/tenant changes. Failed refresh retains the last response with a warning and load time. Vehicle Detail refreshes on page reload; history is not polled or downloaded by the current-location map.

Leaflet 1.9.4 loads client-side and uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible attribution. Tile failure preserves the list/coordinates. Public OSM tiles are best-effort: retain Referer/caching behavior and attribution, with no bulk downloading/prefetch. Higher-volume deployments need an appropriate tile service. References: [Leaflet](https://leafletjs.com/reference.html), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## TEST feed and retention commands

Use only development project `eeryymswcufnebibigqf`, a migrated database, running Docker/API on `127.0.0.1:9000`, configured token and a registered `traccar` device with unique `TEST-` UID assigned to a disposable vehicle:

```sh
pnpm --filter api gps:poc --uid=TEST-your-unique-device
pnpm --filter api gps:retention --business=<verified-tenant-uuid>
pnpm --filter api gps:retention --business=<verified-tenant-uuid> --apply
```

The PoC command refuses another environment/project or ambiguous assignment. It launches a unique official Traccar 6.16.0 Docker container pinned to a digest, with memory storage, OsmAnd only and loopback port **5055**. Its temporary XML token config is mode 0600 and never printed. Port conflicts fail without stopping/reusing another container. On macOS Docker Desktop forwarding uses `host.docker.internal:9000`; check routing/API/token if canonical verification fails. No remote provider listener is deployed.

Synthetic OsmAnd packets pass through Traccar JSON forwarding and canonical ingestion; the script checks 12 knots →22.224 km/h, semantic duplicates and delayed fix ordering. Per-run timestamps allow repeated use of a TEST UID. Its non-secret JSON output is terminal evidence, not a generated repository report. Idempotent cleanup removes its own container/config on completion/failure/SIGINT/SIGTERM; stored points remain on the chosen assignment until owned-data cleanup or retention. References: [Traccar forwarding](https://www.traccar.org/forward/), [forwarder-only configuration](https://www.traccar.org/forwarder-only/), [pinned speed units](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/model/Position.java).

History expires **30 days after receivedAt**, except the latest point of each active assignment remains as its last-known location, even after 30 days offline. Ended assignments have no exception. This is distinct from ingestion's recorded-time acceptance window. Retention is development-only, tenant-bounded, defaults to dry run and processes at most 1,000 eligible rows per invocation. Review then apply/repeat bounded batches. There is no automatic production scheduler; historical Trip results can become partial or disappear as points expire.

## Derived Trip history and route replay

Trips are calculated on demand from existing `gps_positions`; there is no duplicate history table, persisted summary or new migration. OWNER/ADMIN/OPERATIONS receive `trip.read`; the same active-profile/business/membership guards and tenant predicates protect every Trip/filter/detail/route query. An opaque Trip ID is not an authorization credential. GPS ingestion and current-location selection remain separate and unchanged.

| Endpoint | Query / response boundary |
| --- | --- |
| `GET /trips` | Optional `vehicleId`, `rentalId`, `from`, `to`, `sort=asc/desc` (default desc), standard page/limit; default last 24 hours |
| `GET /trips/:id` | One rederived summary in its original exact query window |
| `GET /trips/:id/route` | Recorded points with page/limit; default and maximum 500 points per page, `total` and `hasMore` |

Ranges use `[from,to)`, require timezone-qualified timestamps, increase strictly and span at most **7 days**, with end no later than five minutes ahead. At most **10,000 candidate fixes** may be considered before trip-list pagination; denser ranges fail with 422 `TRIP_POINT_LIMIT` and must be narrowed. Invalid ranges/IDs return 400 `INVALID_TRIP_RANGE` / `INVALID_TRIP_ID`; unavailable or cross-tenant filter/detail resources return 404 `TRIP_NOT_FOUND`. Empty data is a valid empty list. Route paging bounds transfers rather than silently truncating server derivation.

Derivation sorts by recorded time, with first `receivedAt`/ID canonicalizing duplicate assignment/timestamp fixes. It uses each point's historical assignment resolved at ingestion, never today's device assignment. SQL selection and domain derivation both revalidate `recordedAt` within `[assignedAt,unassignedAt)`; a clock-skew-tolerated fix dated after its assignment later ended is excluded rather than attributed to another assignment. Assignment changes always split; gaps over **10 minutes** split without connecting a line. `ignition=false` with speed below **3 km/h** closes a segment. Movement requires a fix at least 3 km/h or a usable consecutive edge of at least **30 metres**; stationary-only groups are omitted. Consecutive Haversine distances are estimates, not odometer readings. Edges implying more than **250 km/h** are excluded from distance and carry `breakBefore:true` so replay never draws across the jump.

Each summary includes vehicle/assignment/device identity, optional inferred rental ID, UTC start/end and duration, estimated distance, point count, recorded/received freshness, `sourceMode:TEST`, `derivation:DERIVED`, `distanceKind:ESTIMATED`, route availability and partial reasons. A single moving fix stays a partial Trip with `INSUFFICIENT_POINTS` and no usable route. Unobserved starts/ends, gaps, assignment boundaries, conflicting ignition/movement, implausible position jumps and a query before the 30-day retention boundary are explicit limitations (`START_NOT_OBSERVED`, `END_NOT_OBSERVED`, `GAP_BEFORE/AFTER`, `ASSIGNMENT_BOUNDARY`, `IGNITION_CONFLICT`, `POSITION_JUMP`, `RETENTION_WINDOW`). `RANGE_START` additionally marks a segment whose assignment began before the query window without an observed preceding stop; the API does not claim that its first returned fix is the actual departure. Freshness uses the same 120/600-second recorded-time thresholds as current location and does not make historical replay live tracking.

Rental associations use tenant/vehicle-matching scheduled windows of RESERVED/ACTIVE/COMPLETED rentals. `CONTAINED` means the full derived segment fits the scheduled interval; `OVERLAP` means only a time intersection. Both carry `basis:SCHEDULED_WINDOW` and do not prove actual customer use. A scalar `rentalId` is set only for exactly one containing interval; the association list preserves overlaps. Filtering by Rental uses these associations without inventing a route across a boundary.

IDs encode the vehicle, start-fix ID and exact normalized query window, then detail/route rederive with authorization. Late fixes can change grouping or IDs; retention can remove a Trip or make it partial. Refresh the list when a saved detail returns unavailable. Partial reasons describe observable limits; missing packets cannot be reconstructed.

`/app/trips` uses this live API with Vehicle/Rental/date filters and detail replay; Vehicle/Rental detail link to the corresponding filtered history. Leaflet replay draws only received bounded route points, honors line breaks and provides start/end markers and simple scrub/step controls. It does not poll history or fabricate missing points. Synthetic Trip examples stay under development-only previews.

## Web UI and preview boundaries

Live `/app` features use generated API contracts, verified tenant context and shared semantic tokens/components. `apps/web/src/styles/tokens.css` defines the orange/gray/white system: body 15px/1.55, navigation 14px, forms/tables 14px, sections 17px, page titles 28px, helpers/badges 12px. Use semantic/component styles rather than global zoom/transforms. Native dialogs provide labelled titles, Escape/focus containment and restored trigger focus; notices use alert/status regions. Status includes text, not color alone. Tables scroll within panels; navigation collapses and map/list adapts on smaller screens. Verify relevant pages at 1440/768/390px with DOM/browser interaction; no screenshots by default.

Login retains Supabase `signInWithPassword`, pending/error feedback, SSR cookies and business-cookie reset, then `router.replace('/app')`; a competing refresh can race navigation. Preserve the same shared design tokens and components.

Only `next dev` exposes `/dev-preview/business` and `/dev-preview/platform`, with clearly labelled historical synthetic fixtures. Unimplemented Commercial and platform administration remain previews. `/superadmin/*` redirects to platform preview only in development; all preview/platform routes return 404 under production `next start`. Server checks must happen before importing fixture modules; tenant OWNER is never a platform principal. There is no production flag to enable these synthetic screens. Existing operational preview wrappers still pass the tenant layout/proxy.

Future live platform work needs an independent platform principal/permissions, backend/server guards, scoped global list/write APIs and redacted global audit. Never iterate tenant IDs from the browser, expose server keys or grant global access through `user_metadata`. Commercial/payment/accounting, geofences/alerts and physical GPS production onboarding remain outside current scope. Production GPS also needs durable deployment, credential rotation/rate limiting, monitoring, scheduled retention and map capacity planning.

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

## Current stage and historical records

The current plan and sole implementation output is [Stage 6](stages/Stage_6_Trip_History_and_Codebase_Refactor_Compact.md). Append verified results/limits there in the same implementation commit; later stages use their own current file. Do not create separate output/validation/architecture/recap Markdown, QA JSON manifests or screenshots unless explicitly requested. Runtime source, tests, migrations and generated contracts are unaffected by this documentation rule.

Historical stage plans, output, validation reports and screenshots remain retrievable from Git commit `85d4f2b4b1d7a75b8a24ec175ea61610b11ba989`, for example `git show 85d4f2b:STAGE_OUTPUT.md` or `git ls-tree -r --name-only 85d4f2b docs`. Current operational policy is consolidated here; historical completion counts are not current verification results. Both `CLAUDE.md` shims continue to reference their adjacent AGENTS rules; Next.js maintains the web shim during development.
