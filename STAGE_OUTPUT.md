# Stage Output

Permanent chronological implementation history. This is the only accumulated stage-output file; never delete it. Historical results below were recovered from Git, not rerun during consolidation. Current setup/policy lives in [docs/development.md](docs/development.md).

History sources: Stage 1 completion record at `6619a21`; Auth/SaaS source at `59cc975`; original UI/Stage 3–5 log at `85d4f2b`; final Stage 6 output at `a5395ed`. The unnumbered UI rollout is grouped with Stage 2 as the follow-up before Stage 3. No independent Stage 0 output was found.

## Stage 0 output

**Status:** NOT VERIFIED — no separate Stage 0 plan, implementation output or attributable commit was found in the available repository history.

### Delivered

- No Stage 0 completion is asserted. The earliest available code commit is the Stage 1 monorepo foundation (`f00effa`, 22/09/2026).

### Verification

- Git history reviewed during consolidation; Stage 0 scope, commands and results are not verified.

### Boundaries & Remaining

- Earlier product planning or external artifacts may exist outside this repository; their delivery cannot be inferred from later code.

### Next-stage Handoff

- Use the verified Stage 1 foundation below as the technical starting point.

## Stage 1 output

**Status:** COMPLETE as recorded on 22/09/2026.
**Implementation commits:** `f00effa` → `0eccf1c` → `4fa54f8` → `6619a21`.

### Delivered

- Initialized private pnpm monorepo with Next.js Web, NestJS API, shared contracts/config packages, pinned pnpm 11.19.0/Node 24.21.0 and independent/combined dev scripts.
- Prepared placeholder env templates, ignored real credentials, managed development Supabase `eeryymswcufnebibigqf`, Auth/Storage connectivity and certificate/hostname-verified PostgreSQL pooler access with the public CA.

### Verification

- Historical completion record reports PASS for frozen-lockfile install, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, local Web/API HTTP and read-only database/Auth/Storage connectivity. Exact test counts were not retained in that record.
- Owned setup servers stopped and original ports cleared at handoff; these are historical checks, not current port assignments.

### Boundaries & Remaining

- Foundation only: zero public business tables, no application Auth integration, tenant model, Fleet/Rental/GPS domain or staging/production deployment.

### Next-stage Handoff

- Implement verified Supabase identity, NestJS authorization, tenant schema/migrations and isolation tests.

## Stage 2 output

**Status:** Auth/SaaS Core implemented; UI follow-up delivered with the recorded boundaries below.
**Implementation commits:** `59cc975` (23/09/2026), `ead0e8e` (22/10/2026 UI follow-up; originally unnumbered input `Rental_Fleet_OS_UI_Reimplementation_Plan_Visual_Reference_v2.md`).

### Delivered

- Added Supabase password login/SSR cookies, NestJS bearer verification and verified active profile/business/membership context; business selection does not itself authorize access.
- Added Business, profiles, memberships, branches, settings and audit schema/APIs, SQL migration/RLS, OWNER/ADMIN/OPERATIONS policy, active-owner protection, tenant lock plus atomic audit/rechecks, generated contracts and development-only repeatable demo seed.
- Rebuilt Business/Platform shells and shared orange/gray/white tokens/components; live `/app`, business/users/branches/settings/audit forms preserve URLs and tenant reload. Synthetic Fleet/Commercial/Platform designs are labelled development previews; `/superadmin` grants no global tenant-owner privilege.

### Verification

- UI follow-up log records PASS for `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (**3 tests / 2 files**), **9/9** production HTTP boundary checks and fixture-backed Auth/API browser flows.
- Responsive checks at 1440/1280/1024/768/390px had no page overflow. Real Supabase `pnpm test:e2e` was explicitly not run for this UI follow-up; standalone original Stage 2 handoff counts are not verified from the recovered log.

### Boundaries & Remaining

- Live SaaS Core only at that point; Fleet/Customer/Rental/GPS/Trip remained synthetic previews. Global platform authorization/backend and source-image visual signoff were not delivered. No staging/production deployment.

### Next-stage Handoff

- Promote Fleet registry/assignment to tenant-scoped APIs without treating device registration as telemetry.

## Stage 3 output

**Status:** COMPLETE in development as recorded 22/10/2026.
**Implementation commit:** `4b8baa2`.

### Delivered

- Added `vehicles`, `gps_devices`, `device_assignments`, Drizzle mappings, composite tenant foreign keys, RLS and one-current-assignment constraints; migration `20261022151714_fleet_core.sql` used Supabase CLI.
- Delivered vehicle/device list/detail/create/update and assignment/end/history APIs with pagination/filtering, immutable global provider/UID identity, canonical plates, ACTIVE/INACTIVE lifecycle, business-lock authorization rechecks and atomic redacted audit.
- Promoted `/app/vehicles`, `/app/vehicles/devices`, `/app/vehicles/:id` to live permission-aware UI; OWNER/ADMIN manage, OPERATIONS reads. Reassignment preserves ended history; disable requires ending the assignment.

### Verification

- Historical `pnpm build`, `pnpm lint`, `pnpm typecheck`: PASS. `pnpm test`: **38/38 / 5 files**; `pnpm test:e2e`: **19/19 / 2 files**, real development Supabase only; production HTTP boundaries **12/12**.
- Real browser CRUD/assign/end/reassign/history/RBAC/loading/error/404 and 1440/768/390px checks passed. Nine application tables had RLS. Exact owned QA records were removed, seven audit events retained and temporary servers stopped.

### Boundaries & Remaining

- Registry/assignment did not imply GPS signal. Rental availability, telemetry/maps/trips, Commercial and global platform backend remained outside this stage; no staging/production deployment.

### Next-stage Handoff

- Add Customer/Rental lifecycle and concurrency-safe time-based availability while retaining Fleet identity/history invariants.

## Stage 4 output

**Status:** COMPLETE in development as recorded 22–23/10/2026.
**Implementation commit:** `e892474`.

### Delivered

- Added tenant Customers/Rentals, RLS/composite foreign keys and migration `20261022163648_rental_core.sql`. Lifecycle is DRAFT → RESERVED → ACTIVE → COMPLETED, with DRAFT/RESERVED cancellation and validated handover/return odometers.
- Added reservation/extension, derived overdue/current-next state and date-based availability APIs. Half-open `[startAt,endAt)` GiST exclusion and one-ACTIVE-per-vehicle constraints supplement locked checks; an unreturned overdue rental continues blocking use.
- Delivered live Customer/Rental list/detail/edit/wizard/actions and dashboard schedule/active queue plus Vehicle current/next rental. Disable rejects blocking rentals; amount/deposit fields are simple validated values, not a payment ledger.

### Verification

- Historical `pnpm build`, `pnpm lint`, `pnpm typecheck`: PASS. `pnpm test`: **94/94 / 9 files**; `pnpm test:e2e`: **27/27 / 3 files** on development; production HTTP boundaries **17/17**.
- Real browser lifecycle/availability/overdue/role denial/history and 1440/768/390px checks passed. Eleven application tables had RLS; owned Vehicle/Customer/two Rentals removed, 13 audit events retained and temporary servers stopped.

### Boundaries & Remaining

- No telemetry/Trip, advanced pricing, payment/refund ledger, accounting, Customer Portal or global platform backend. No staging/production deployment.

### Next-stage Handoff

- Connect a verifiable GPS source through authenticated canonical ingestion and tenant current-location projections.

## Stage 5 output

**Status:** COMPLETE for the Traccar TEST-feed development scope as recorded 23/10/2026.
**Implementation commit:** `85d4f2b`.

### Delivered

- Integrated official pinned Traccar 6.16.0 OsmAnd TEST feed → token-authenticated webhook → canonical adapter → `gps_positions`, with composite tenant/historical-assignment identity, RLS/Data API denial, indexes and semantic deduplication. Raw provider packets/secrets are not stored in audit/logs.
- Converted knots to km/h, validated fix times/coordinates and fixed source mode to TEST. Assignment is resolved at `recordedAt`; latest current-assignment fix uses recorded-time ordering/first-received ties, so delayed packets cannot move current location backwards.
- Added `/vehicles/:id/location`, `/fleet/locations`, live Fleet Map/dashboard/Vehicle projections with Leaflet/OpenStreetMap, explicit TEST/FRESH/STALE/OFFLINE/NO_DATA/UNASSIGNED, paginated polling and hidden-tab cancellation. Added 30-day received-time retention CLI preserving each active assignment's last-known fix.
- Refined shared typography and Login; fixed password-login navigation race and secret-safe idle-PG-pool error handling. Web moved to 4000; API's then-3001 port was superseded by Stage 6's 9000.

### Verification

- Historical `pnpm build`, `pnpm lint`, `pnpm typecheck`: PASS. `pnpm test`: **110/110 / 11 files**; `pnpm test:e2e`: **32/32 / 4 files** on development; production HTTP boundaries **18/18**.
- Real Traccar conversion/dedup/delayed order, same-UID rerun and SIGTERM container/config cleanup passed. Browser Login/map/filter/marker flows and **40 responsive DOM checks** passed; 47 historical JPEGs were later retired in Stage 6, not recreated here.
- Twelve application tables had RLS; only owned QA points/domain records were removed, seven audit events retained and temporary servers/containers stopped.

### Boundaries & Remaining

- LIVE means authenticated real API/database pipeline; source remains synthetic TEST FEED. No physical tracker/provider deployment, credential rotation, production retention scheduler, capacity certification or staging/production release was validated. Platform/Commercial stay development previews.

### Next-stage Handoff

- Derive bounded historical Trips/routes from the same GPS history; do not duplicate positions or imply measured odometer distance.

## Stage 6 output

**Status:** COMPLETE as recorded 23/10/2026.
**Implementation commit:** `923c69e775843f4cb8ff399932388d05dd6ff58b`; SHA-recording follow-up `a5395edb5723f2626093a0289043958ef7275949`.

### Delivered

- Added on-demand `telematics/trips` and `trip.read` for OWNER/ADMIN/OPERATIONS: tenant-scoped `/api/v1/trips`, `/trips/:id`, `/trips/:id/route`, Vehicle/Rental/date filters and generated contracts. No duplicate history table/new migration.
- Derivation uses historical assignment validity, recorded-time ordering/first receipt ties, >10-minute gap/assignment splits, 3 km/h or usable 30m movement and ignition stops. Haversine distance is ESTIMATED; >250 km/h edges break lines. Single fixes/gaps/window/retention/ignition limitations remain explicit partial states.
- Queries default to 24h, cap ranges at 7d, candidate fixes at 10,000 and route pages at 500; IDs are query-scoped and may change/disappear after late fixes/retention. Rental links mean scheduled-window CONTAINED/OVERLAP, not proof of actual customer use.
- Promoted `/app/trips` and detail replay to live API data with Leaflet route breaks/start/end/timeline, UTC+7, filters, loading/empty/error states and Vehicle/Rental history links; no continuous historical polling or fabricated route.
- Refactored API/Web into Fleet vehicles, Rentals and Telematics GPS/Trips; moved synthetic business previews and PoC/retention scripts. Shared picker/query/date utilities remain presentation/data-access boundaries. Kept old URLs/contracts/auth and active workflows.
- Moved Rental API to **9000**, retaining Web **4000**, including env/examples/defaults/Docker/Compose/Traccar forwarding. Consolidated domain runbook and removed 138 old docs/artifacts (122 screenshots), preserving Git history; that stage's temporary per-stage-output convention is superseded by Stage 7's permanent root log.

### Verification

- Historical `pnpm build`, `pnpm openapi`, `pnpm lint`, `pnpm typecheck`: PASS. `pnpm test`: **126/126 / 14 files**; `pnpm test:e2e`: **35/35 / 5 files** on development Supabase; production HTTP boundaries **21/21**.
- Real moved `pnpm --filter api gps:poc --uid=<owned TEST UID>` and route QA passed: 11 unique TEST fixes → two partial segments, delayed/duplicate packets preserved current location. Browser replay/filters/linked history/invalid range/missing Trip/Login/empty state and **24 responsive DOM checks** passed without screenshots.
- Exact owned QA records removed, seven audit events retained. Traccar/config/production QA 4101 stopped; user-requested Web4000/API9000 retained. Final health/Login/CORS checks passed and 3001/4101/5055 were clear.

### Boundaries & Remaining

- TEST feed only; no hardware/durable provider, staging/production deployment, map matching, odometer certification, materialized summaries or continuous interpolation. Separate bounded detail/route reads can require reload during concurrent history changes. Global platform, alerts/geofences and payment/accounting remain unimplemented.

### Next-stage Handoff

- Harden ingress bounds/abuse handling, authorized diagnostics, retention invocation and Trip stability/recovery while preserving TEST/tenant boundaries.

## Stage 7 output

**Status:** COMPLETE for the development/TEST-feed scope, verified 23/10/2026.
**Input:** `Stage_7_Telematics_Hardening_and_Stage_Output_Consolidation.md`.
**Implementation commit:** `9345e9d299cd656f6c72d479f3469de07fd83eea` — `feat: harden telematics and consolidate stage outputs` on `main`, baseline `a5395edb5723f2626093a0289043958ef7275949`. This implementation commit includes the output; the following output-only commit records its actual SHA.

### Delivered

- Restored this permanent root log with chronological Stage 0–6 history recovered from Git and the previous Stage 6 output. Stage 0 remains explicitly NOT VERIFIED; historical checks are not claimed as rerun. Removed the old per-stage documentation directory after consolidation. README/AGENTS/runbook now point only here for accumulated outputs; future input plans are not copied into reports.
- Removed both root/Web `CLAUDE.md` files as requested. Set Next.js `agentRules:false` so launch does not recreate them; manual Web AGENTS retains the requirement to read installed version-specific docs. README now gives concise `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm dev:web` and `pnpm dev:api` commands, preserving Web **4000** / API **9000**.
- Added GPS webhook-only pre-parse token authentication and **16 KiB uncompressed JSON** cap. Invalid credentials, malformed JSON, oversized bodies and unsupported media/encoding receive secret-safe 401/400/413/415 envelopes with server-generated request IDs. Other API routes keep their existing parser settings. Declared the existing Express **5.2.1** runtime as a pinned direct dependency for the route-scoped parser; lockfile updated.
- Added bounded process-local ingest controls: **600 requests / 60-second fixed window**, **120 validated packets / device / window**, **16 concurrent requests**, at most **1,024 hashed identity buckets**. Authentication failures count toward the global cap, duplicates consume capacity but remain idempotent in storage, and 429 `GPS_RATE_LIMITED` includes `Retry-After`. Internal aggregate outcome logs use fixed categories without UID/IP/token/body/coordinates and flush on the next window's request; logging may be disabled with `LOG_REQUESTS=false`.
- Added `GET /api/v1/fleet/telemetry/diagnostics`, authorized by `gps.read` for OWNER/ADMIN/OPERATIONS. It returns only the verified tenant's freshness breakdown, unique stored fixes/devices received in the last 15 minutes, last recorded/received timestamps, TEST mode, ingest-enabled flag and limits. No identifiers, coordinates, secrets or global failure counters are exposed. OpenAPI/types regenerated; new 413/415/429 docs apply only to the GPS webhook.
- Trip derivation now independently enforces the half-open query window in addition to SQL bounds. Added deterministic tests for exact 10-minute gaps, first-receipt/ID ties, vehicle transitions, window boundaries and 120/600-second freshness. Existing 7-day/10,000-candidate/500-route-point caps, historical assignment, rental-overlap semantics and broken-edge replay remain intact. Malformed encoded IDs render unavailable; not-found/error recovery validates and restores Vehicle/time filters, with API authorization applied again. Late-fix/removed-start recovery is tested against PostgreSQL.
- Dashboard/Fleet Map/Vehicle Location now explain STALE/OFFLINE coordinates as last-recorded, distinguish NO_DATA from UNASSIGNED, preserve UTC+7/TEST labels and expose an explicit GPS refresh retry after failure. Polling 401/403 redirect to Login/access denied; failed refresh keeps the last snapshot and successful-load timestamp. No template redesign or fabricated data.
- Replaced retention's separate select/delete with a tested bounded one-shot operation. Default dry-run, explicit tenant, **1–1,000 rows/batch** and **1–10 batches/apply invocation** (maximum 10,000 rows) are enforced. Each apply batch shares the Business lock with ingestion/assignment lifecycle, uses database-clock **30-day receivedAt** cutoff, protects the current assignment's recorded/first-received/ID latest fix, sets 2-second lock/10-second statement timeouts and reports actual deleted counts. Added `gps:retention --help`, `gps:plans` and `gps:retention:verify`; no scheduler or staging/production execution was installed.

### Verification

- `pnpm build`: **PASS**, API and Next.js production build. `pnpm openapi`: **PASS** after the final webhook-only response-doc adjustment. `pnpm lint` and `pnpm typecheck`: **PASS** API/Web.
- `pnpm test`: **159/159 tests / 18 files PASS**, including migration/security regression, 16 retention tests, 12 new GPS ingress/diagnostics tests and five added Trip boundary tests. Final deterministic quota-clock fixture check: **5/5 ingress HTTP tests PASS**.
- `pnpm test:e2e`: **37/37 tests / 5 files PASS** in 185.09 seconds on development `eeryymswcufnebibigqf`, including the new GPS security/diagnostics and Trip late/retention recovery cases plus SaaS/Fleet/Rental regression. No staging/production test, migration or seed was run.
- `UI_TEST_BASE_URL=http://127.0.0.1:4101 node --test apps/web/test/preview-boundaries.mjs`: **21/21 PASS**, seven preview/platform routes excluded and 14 private routes redirected. Temporary production PID 52496/session 13316 was stopped after QA.
- `pnpm --filter api gps:poc --uid=<owned TEST UID>`: **PASS**, official pinned Traccar 6.16.0 decoder → authenticated bounded webhook on API9000 → Supabase; **12 knots →22.224 km/h**, semantic retransmission stored once and delayed fix preserves current location. Owned Traccar/container/config cleaned automatically.
- Browser DOM/interaction: **PASS**, five genuine API-derived FRESH/STALE/OFFLINE/NO_DATA/UNASSIGNED fixture states, truthful last-recorded copy, malformed ID handling, live Trip replay and late-packet recovery back to the same Vehicle/time filters with a changed Trip ID and three GPS points. **15 responsive checks** across Fleet Map, Vehicle/no-data, recovery, Trip list and Dashboard ×1440/768/390px had no page overflow. No screenshots or QA report artifacts were created. Failed-refresh retry and 403 navigation were code-reviewed; no artificial browser network-failure injection was claimed.
- `pnpm --filter api gps:retention:verify`: **7 real PostgreSQL checks PASS**: dry-run unchanged, received-time cutoff, protected active latest, observed wait on ingestion's Business lock, post-lock snapshot protecting new current, other tenant untouched, concurrent maintenance idempotent. Two exact owned fixture businesses removed; **zero remaining**.
- `pnpm --filter api gps:plans`: **PASS** using EXPLAIN ANALYZE/BUFFERS. Existing development dataset had zero positions; 50,000 indexed temporary GPS rows across ten tenants/50 vehicles modeled 5,000 target-tenant fixes. No public rows or persistent schema/statistics were changed; temp dataset rolled back. Measurements below justify retaining existing indexes, not a production capacity claim.

| Query | Development / 0 GPS rows | Synthetic temporary / 50,000 GPS rows |
| --- | --- | --- |
| Retention candidates | 0.150 ms | 21.122 ms / 1,000 rows |
| Current assignment latest | 0.179 ms | 0.143 ms / 5 rows |
| Tenant Trip range | 0.116 ms | 16.470 ms / 5,000 rows |
| Vehicle Trip range | 0.086 ms | 9.556 ms / 1,000 rows |

- Existing assignment-latest/assignment-identity access indexes were used; no measured need for a new index/migration. Supabase security check: **12/12 public tables have RLS**, direct GPS SELECT denied to both anon/authenticated. The no-policy GPS notice is intentional deny-all; the pre-existing leaked-password-protection warning remains a paid-plan constraint ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). TLS certificate/hostname checks remain enabled.
- Exact browser QA cleanup: **9 positions, 4 assignments, 5 vehicles, 4 devices removed**, **13 audit events retained**. Empty Trip list confirmed afterward. Full E2E owns and cleans its own exact fixture IDs. No unrelated tenant or Digital Twin data/process was changed.
- Final runtime audit: API health **200**, Web Login **200** and CORS **204**; user-requested dev Web4000 (PID 55022) / API9000 (PID 55031), owned combined session 16553, remain running. Ports 3001/4101/5055 are clear; no owned Traccar QA container remains. `git diff --check` and five canonical relative links **PASS**; both removed instruction shims stayed absent after `pnpm dev`. Only root output, README, root/Web AGENTS and canonical development runbook remain as repository Markdown; staged audit **PASS**: 36 changed source/operational paths, no tracked real env, credentials, private keys, screenshots or additional stage reports.

### Boundaries & Remaining

- LIVE denotes the authorized API/database/UI pipeline; source remains **TEST**, never physical/REAL tracker certification. Distance is ESTIMATED; scheduled Rental association is not confirmed customer use. On-demand Trip IDs may change/disappear after late packets or retention; detail and route are separate reads and may require reload.
- Limits are fixed-window and per-process, reset on restart, with no distributed limiter/durable queue. Node's current request timeout is five minutes; slow authenticated bodies can occupy the 16 bounded slots until that deadline. Before external provider exposure, configure gateway body/read deadlines, source/connection controls, credential rotation and durable deployment/monitoring. Aggregate failure logs are not a persistent metrics store and flush only on subsequent traffic.
- Retention invocation is ready for a future scheduler but remains restricted to the verified development project. No staging/prod cron, destructive retention there, deployment or hardware onboarding was performed. The 50k-row benchmark is directional synthetic evidence, not load certification. No new GPS/Trip persisted history or migration was needed.
- Global Superadmin APIs/RBAC, Commercial/payment/accounting, alerts/geofence and Customer Portal remain outside this stage. Historical UI source-image signoff and complete accessibility audit are not newly asserted.

### Next-stage Handoff

- Recommended next milestone without hardware/provider access: dedicated **Superadmin global RBAC/API**, using an independent platform principal and server guards; never promote a tenant OWNER to global access or iterate tenant IDs from the browser. Start with scoped global read APIs/audit and explicit tests while keeping current platform fixtures development-only.
- If real provider/hardware access is supplied later, the telematics handoff is canonical TEST adapter → bounded authenticated ingress → tenant diagnostics → historical assignment/current location/Trip recovery plus bounded retention commands. External gateway controls, durable provider deployment and hardware evidence are prerequisites before claiming production GPS support.

## Stage 8 output

**Status:** COMPLETE for Superadmin Core read-only scope, verified 23/10/2026.
**Input:** `Stage_8_Superadmin_Core_Implementation_Compact.md`.
**Implementation commit:** this stage's implementation commit on `main`, baseline `58d89b311825922654176d70f7d1daaf33be6554`; the resulting SHA is authoritative in Git. Exactly one commit includes this output and all deliverables; no SHA-only follow-up.

### Delivered

- Fixed AGENTS first: one implementation commit per stage, append actual output before commit, never create a follow-up/amend solely to embed its own SHA. Updated current runbook accordingly; root output/history stays permanent. Broad validation is reserved for Final Validation, not automatically rerun each implementation stage.
- Added `platform_memberships` with one independent `PLATFORM_OPERATOR` identity per active profile and explicit `platform.overview.read` / `platform.business.read` permissions. `AuthGuard` verifies current Supabase identity, then `PlatformGuard` checks active profile/platform grant; tenant OWNER/ADMIN/OPERATIONS, user metadata and selected-business headers/cookies never grant platform access. A platform-only identity gets no tenant operational membership.
- Added separate `platform_audit_logs`; every successful platform read rechecks principal/profile under row locks and commits its audit with the read. Audit failure prevents result delivery. Metadata contains only a server request ID; targeted business ID is separate. Platform reads never enter tenant audit. Migration **`20261023073056_platform_core.sql`** was created through Supabase CLI and applied only to development; both new tables have RLS and deny all PUBLIC/anon/authenticated Data API access, including for authenticated operators. Drizzle mapping and clean migration-replay assertion updated to 14 tables.
- Added authorized `GET /api/v1/platform/me`, `/platform/overview`, `/platform/businesses` and `/platform/businesses/:id`. SQL aggregates selected businesses without browser tenant iteration or per-tenant API calls. Businesses list has bounded pagination (≤100), literal name search, ACTIVE/DISABLED status and stable allowlisted sort. Detail returns approved business metadata plus branches, membership rows, fleet/rentals and current-assignment GPS freshness counts; no user emails, customer contacts, coordinates, tracker identity, notes or credentials. Memberships count links rather than globally unique people; totals include disabled businesses and GPS remains TEST.
- Promoted `/superadmin`, Businesses list/search/filter and Business Detail to live SSR using generated API contracts and the existing shared shell/design system. Platform server data access has no dependency on tenant `/me`, current-business cookie or `TenantGuard`. Proxy now protects `/superadmin/*`; explicit platform login and allowlisted local return paths support safe navigation. Tenant OWNER receives platform-specific access denied while ordinary Business Admin routes/login remain intact.
- Features, Integrations, global Users/Audit and System Settings are authorized **unavailable** screens, with no production fixtures or fake writes. Development platform previews remain separately labelled and production-excluded. No business creation, tenant suspension, entitlement/billing write or global user/support management was added.
- Added guarded `pnpm --filter api platform:seed`: exact development project plus `ALLOW_DEMO_SEED=true`, existing ignored fixture, separate Auth identity/profile/platform grant, refusal of tenant-account reuse and preservation of disabled states. Prepared `accounts.platformOperator` in ignored root `.env.demo.json` mode 0600; no password/token printed and no tenant OWNER promoted. The command uses an exclusive credential-file lock and idempotent DB setup/audit.

### Minimal Verification

- `pnpm build`, `pnpm openapi`, `pnpm typecheck`, `pnpm lint`: **PASS** API/Web; generated platform contracts used by live UI.
- `pnpm --filter api exec vitest run src/platform/platform.spec.ts src/database/platform-migrations.spec.ts src/database/platform-seed-policy.spec.ts src/database/migrations.spec.ts`: **16/16 tests / 4 files PASS**. Includes tenant OWNER/forged metadata/header denial, independent operator access, disabled profile/grant, transactional recheck and fail-closed audit, minimal aggregate projection, stable bounds/search, bootstrap environment/identity policy and deny-all RLS/migration replay.
- `pnpm --filter api exec vitest run --config vitest.config.e2e.ts test/platform.e2e-spec.ts`: **4/4 focused E2E / 1 file PASS**, 15.35 seconds on development `eeryymswcufnebibigqf`. Real Auth: OWNER/ADMIN/OPERATIONS denied even with spoofed business headers; operator independent of tenant context but denied tenant APIs; bounded real metadata/pagination and tenant isolation preserved; disabled grant/profile immediately denied and restored; audit separated and Data API table reads/writes denied.
- `pnpm --filter web exec node --test test/auth-navigation.test.mjs`: **18/18 PASS**, local allowlist/deep links, external/protocol-relative/control/out-of-scope/traversal rejection.
- `UI_TEST_BASE_URL=http://127.0.0.1:4101 node --test --test-name-pattern='superadmin|dev-preview/platform' apps/web/test/preview-boundaries.mjs`: **6/6 focused checks PASS** (four private Superadmin redirects plus two production platform-preview 404s). Temporary production PID 60385/session 43942 stopped afterward; 4101 cleared.
- Short DOM smoke **PASS**: dedicated operator password login → live Overview (two actual demo businesses) → searched Businesses → correct real Business Detail; global Users explicitly unavailable. Tenant OWNER login to platform redirected to server access denied, then existing tenant dashboard still worked. No viewport matrix, screenshots, visual comparison or extra QA artifact was produced.
- `pnpm db:migrate --dry-run` then `pnpm db:migrate`: **PASS**, verified development project/TLS only. Direct database check confirms both new tables RLS-enabled and SELECT denied to anon/authenticated. `supabase db advisors --linked --type security --level warn` found only the pre-existing leaked-password-protection warning ([paid-plan remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); no new warning from this migration.
- Dev Web **4000** (PID 60462) / API **9000** (PID 60477), owned combined session 59091, remain running as previously requested; API health and Web Login **200**. Platform read audit and dedicated demo account are intentionally retained; E2E restored its temporary disabled statuses. No unrelated tenant rows, Digital Twin process, staging/production migration or seed was changed.
- `git diff --check`, five canonical relative links and staged-secret review: **PASS**, 43 deliverable paths with no detected real env/token/private-key material. No additional Markdown report, stage directory, screenshot or QA manifest was added; real env/credentials and their temporary files remain ignored.

### Boundaries & Remaining

- LIVE platform scope is metadata and aggregates only, authorized independently of tenant roles. Global Users/Audit read UI/API and per-business support/membership views are intentionally not implemented; their screens clearly remain unavailable. Platform read audit is stored internally for a future reviewed audit feature.
- No entitlement, tenant suspension, billing, role-management/write API, customer portal or production deployment. Actual production operators require an explicit trusted provisioning process; development bootstrap refuses staging/production. GPS remains TEST and its aggregate health is not physical tracker certification.
- Full historical `pnpm test:e2e`, cross-domain final regression, exhaustive browser/viewport/visual/accessibility matrices and load/capacity benchmarks were **NOT RUN** in Stage 8, as requested. Existing historical pass records are not claims of current comprehensive validation. No critical platform security failure remains in the focused checks.

### Next-stage Handoff

- Extend platform audit/support read APIs and UI with explicit permissions and reviewed metadata/PII boundaries before enabling the unavailable global screens. Reuse independent platform guards, locked authorization rechecks and separate audit; do not expose browser service keys or tenant operational data by iterating business IDs.
- Run a dedicated Final Validation stage after the intended feature scope is agreed, covering historical tenant workflows, production route boundaries, accessibility/responsive behavior and operational capacity. Keep one implementation commit and this root output convention for subsequent stages.

## Stage 9 output

Input: `Stage_9_Branding_and_Platform_Support_Compact.md`. Implemented 2026-10-23 on current `main`, baseline `a4544bf26513afabe0a759c0f31ebef4d1de689b`. Source/assets/contracts and this output belong to **this stage's implementation commit**; Git is authoritative for its SHA.

### Delivered

- Inspected only approved Canva **Rental Fleet OS** `DAHY0Bey5gc` (five pages); page 1 identifies source mark `MAHY0DdEe94`, page 5 explicitly lists the palette. Downloaded Canva's actual transparent **199×172 RGBA PNG asset rendition**, unchanged, into runtime `public/brand/mark.png` and Next `app/icon.png`. Replaced the old generic car mark/default favicon with shared `BrandLockup` on Login, Business/Platform sidebars and compact top navigation, including mobile identity. Product title/application metadata now says **Rental Fleet OS**. The mark has no baked-in text, so lockup adds the product name once. No substitute logo, illustration or animation was generated; no other Canva design was inspected/used/modified.
- Login uses **“All Your Fleet Operations. One Platform.”**, **“Manage vehicles, rentals, customers, and GPS tracking from one connected workspace.”**, and **“One connected workspace for smarter fleet operations.”** Business forms, navigation, workflow/status/error copy remain Vietnamese. Auth/session, tenant selection and safe return-path logic are preserved.
- Verified Canva mappings: `brand` **#E9702E**, `brand-strong`/focus **#AD4511**, `text-primary` **#2E3540**, `canvas` **#F4F4F3**, `surface`/on-brand **#FFFFFF**. Derived UI tones are explicitly distinguished in tokens: hover **#90380E**, brand-subtle/active **#FFF0E6**, surface-muted/hover **#F8F8F7**, secondary text **#606973**, border/disabled **#DEDEDB**, plus retained semantic success/warning/danger/info tones and shared state borders. White text contrast is **5.78:1** on deep-orange buttons and **7.61:1** on derived hover. These extra tones are UI derivations, not claimed Canva swatches; the current system font is retained (no claim of matching Canva's Manrope typography).
- Shared presentation contracts now include Button size/loading/disabled, native Input/Select/Textarea (separate native choice sizing), labelled FormField/helper/error IDs, Panel/headers, Badge/StatusBadge, DataTable/Pagination with pending/out-of-range behavior, pressed-button Tabs, native-dialog Drawer with busy/Escape/focus-return behavior, Notice and empty/error/loading states. Reused them in Login, both shells, platform Overview/Businesses/Audit/Users and core Fleet/Customer/Rental forms/dashboard; no API business rules moved into primitives. Density remains body **15px**, navigation/forms/tables **14px**, sections **17px**, helpers/badges **12px**, with a shared visible focus ring.
- Added explicit independent **`platform.audit.read`** and **`platform.user.read`** permissions. New `GET /api/v1/platform/audit` has page/limit ≤100, reviewed action, direct target-business UUID, inclusive from/exclusive until, allowlisted createdAt/action ordering and stable ID ties. Default window is 30 days; maximum span 366 days. Projection is only event/actor/target UUID references, reviewed action/entity type, timestamp and validated UUID request ID. Unknown actions/types become `other`; raw metadata, invalid request IDs and unreviewed target details are suppressed. Tenant `audit_logs` is never queried.
- New `GET /api/v1/platform/users` searches/filters/paginates unique application profiles at the backend (display name, profile status, business, role, membership status), without browser tenant loops. Safe summaries expose profile status, independent platform-grant status, fixed role summary and membership counts. `GET /platform/users/:id` returns minimal profile and independently paginated membership/business links/statuses. Active support memberships require profile + membership + business ACTIVE; Overview's existing membership definition remains unchanged. Contacts, Auth metadata, credentials, customer and telemetry details are excluded. Detail audit correctly targets entity type `user`.
- Promoted `/superadmin/audit`, `/superadmin/users` and `/superadmin/users/:id` to live read-only views with filters, paging, meaningful action labels, linked references and shared loading/empty/error states. Business Detail links to filtered support/audit views. Features, Integrations and Settings remain visibly unavailable; no impersonation, password reset, account disabling, role change or rollback controls are enabled.
- Reused locked principal/profile authorization recheck and atomic separate platform read audit; audit persistence failure prevents delivery. No schema migration, browser grant, seed or deployment was needed. Regenerated OpenAPI/TypeScript contracts and updated current README/development instructions.

### Minimal Verification

- `pnpm --filter api exec vitest run src/platform/platform.spec.ts`: **15/15 PASS**. New checks cover explicit route permissions, tenant/ungranted/disabled principal denial, unique-person counts, bounded membership paging/statuses/literal search, reviewed audit projection and date/target/action filters, tenant audit separation, invalid query boundaries and fail-closed audit persistence on each new read.
- `pnpm --filter api build`, `pnpm openapi`, `pnpm --filter api typecheck`, `pnpm --filter api lint`: **PASS**. Initial focused test async assertion/type issues were corrected; final run has no failure or lint warning.
- `pnpm --filter api exec vitest run --config vitest.config.e2e.ts test/platform.e2e-spec.ts`: **5/5 PASS**, 18.91 seconds against development **eeryymswcufnebibigqf**, using real Supabase Auth. OWNER/ADMIN/OPERATIONS denied new endpoints, disabled grant/profile denied immediately and restored, safe live response projections/counts/bounds/404 verified, tenant/platform audits separated and direct Data API platform access denied.
- `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`: **PASS** after correcting a shared-control import; final production build succeeds. `pnpm --filter web exec node --test test/auth-navigation.test.mjs`: **18/18 PASS** (existing Node module-type warning only).
- Narrow HTTP/SSR smoke against existing Web **4000** / API **9000**: Login brand/title/English copy and icon metadata present; authenticated `/superadmin/audit`, `/superadmin/users`, `/superadmin/users/:id` return **200** with expected real content; Next app icon returns PNG **200**. Runtime PNG files are byte-identical RGBA with actual 199×172 dimensions. This is HTTP/SSR verification, not browser interaction/visual signoff.
- Direct browser/keyboard smoke **NOT RUN**: CUA repeatedly reports **“Local browser use is disabled in Work settings”**, including after the user indicated they would enable it. No screenshot, viewport matrix, full historical E2E, benchmark or additional QA artifact was produced. Keyboard focus styles/native dialog behavior were reviewed in source but not interactively certified.
- No new server was started in Stage 9. Existing user-requested dev Web PID **60462** / API watcher child PID **63008**, combined session **59091**, remain on **4000/9000**. No Digital Twin process or staging/production data was changed; test revocations were restored. Successful platform read audits are intentionally retained.

### Boundaries & Remaining

- Direct browser visual/keyboard smoke remains pending browser availability; perform this before final UI signoff. Full historical workflows, comprehensive accessibility/responsive checks and capacity validation remain reserved for Final Validation. HTTP checks/builds do not establish those results.
- Logo is the actual Canva-provided asset rendition, suitable for current 24/38px display and favicon; a full-resolution/vector export was not available through the connected tool. No full-resolution/vector parity is claimed. Only the five explicitly verified palette values are attributed to Canva.
- Users lists application profiles, not every Supabase Auth identity. Actor references can outlive a profile and its detail may return 404. Membership pages are bounded; counts/summaries deliberately distinguish profiles, membership status and business status. Target-business audit filtering covers direct business targets, not every downstream/user-related event.
- No platform account/support writes, entitlements/billing, customer portal, production provisioning/deploy or physical GPS onboarding. GPS remains **TEST**; preview boundaries remain intact.

### Next-stage Handoff

- Complete the short browser smoke for Login branding/focus and live Audit/Users when browser access is available; reserve exhaustive tenant/platform regression, responsive/accessibility and operational checks for Final Validation.
- Any future support write needs its own reviewed permission, minimal projection, transaction/authorization/audit design and tests. Preserve independent platform grants and deny-all browser access; never elevate a tenant OWNER or expose a server key.
- Continue one implementation commit containing code/contracts/assets and this cumulative root log; no per-stage documentation or SHA-only follow-up commit.

## Role simplification and account replacement output

User-directed follow-up, 2026-10-23. Baseline `ff386c3e16de5881bc2454b99b3d64da4c76bbfc`; code, migration, contracts, tests and this output belong to **this follow-up's single implementation commit** (Git is authoritative for its SHA).

### Delivered

- Reduced the active model to **Superadmin** (existing independent internal `PLATFORM_OPERATOR` grant) and business **Owner** (`OWNER`). **Customer** is reserved for a future renter portal and receives no tenant/platform administration grant. Retired ADMIN/OPERATIONS and unknown roles fail closed; Supabase metadata remains descriptive only, never the Nest authorization source.
- Removed role selectors, role hierarchy/matrices and permission-count UI. Business navigation now exposes **Quyền truy cập Owner**; dashboard, business profile, previews, platform support tables and shell use clear Owner/Superadmin labels. Owner access management creates OWNER from `userId` only and updates required ACTIVE/DISABLED `status` only. The API rejects role-selection payloads and the platform Users role filter is removed. Last-effective-active-owner protection, locked authorization rechecks, tenant scope and atomic write/audit behavior remain enforced.
- Added CLI-generated `20261023101547_simplify_business_owner_role.sql`: refuses any remaining non-OWNER membership instead of promoting/deleting it, tightens the DB role check to OWNER and replaces tenant audit RLS with active Owner/profile/business checks. Historical migrations/audits are preserved. Drizzle and OpenAPI/generated contracts match the simplified model.
- On development **eeryymswcufnebibigqf** only, created and password-verified the user's three explicitly supplied identities: Superadmin has platform grant only, Owner has OWNER links to both existing demo businesses, Customer has confirmed Auth/profile only with no management membership or portal. The requested shared password was applied without committing or printing it; no invitation/reset emails were sent.
- Verified new access before removing the **seven exact existing example Auth identities**. Revoked their sessions, disabled old grants/identities and deleted the exact Auth IDs through Admin API; profile/membership cascades removed obsolete access. Retained both businesses, two branches, operational-data counts and historical audit records/actor UUIDs. Final DB: **3 Auth users / 3 profiles, 0 example emails, 2 active Owner links, 1 platform grant, 0 active businesses missing an Owner**.
- Saved configured account credentials only in ignored `.env.accounts.json` mode **0600**; replaced old `.env.demo.json` contents with a retired marker and no stale account credentials. Persistent `db:seed` deliberately refuses, and `platform:seed` rejects retired fixtures, preventing accidental recreation of removed example accounts.
- Updated the six real E2E suites to the Owner-only contracts and a shared exact-development, run-scoped disposable fixture lifecycle. They no longer read named credential files or mutate personal accounts. Fixtures own their temporary Auth/domain IDs, revoke/remove their identities on cleanup and retain audit-bearing businesses as DISABLED tombstones where the audit FK requires it. These rewritten suites were typechecked/linted; remote execution remains for explicit Final Validation.
- Updated README/current development rules and AGENTS to describe the two active roles, deferred Customer, private named-account credentials and disposable test boundaries. No repository/package rename or Customer Portal was added.

### Minimal Verification

- Focused API/security/migration command: `pnpm --filter api exec vitest run src/auth/permissions.spec.ts src/auth/guards.spec.ts src/core/memberships.spec.ts src/platform/platform.spec.ts src/database src/fleet/vehicles/fleet.service.spec.ts src/rentals/rental.service.spec.ts src/telematics/gps/diagnostics.spec.ts`: **104/104 tests, 14 files PASS**. Covers legacy/ungranted/disabled role denial, fixed Owner contracts, last effective Owner, stale-context recheck, audit rollback, tenant isolation, DB role constraint and RLS/migration replay. Retired seed guard separately rerun: **4/4 PASS**.
- `pnpm --filter api build`, `pnpm openapi`, `pnpm --filter api typecheck`, `pnpm --filter api lint`: **PASS**, including rewritten E2E TypeScript. `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`: **PASS**.
- `pnpm db:migrate --dry-run`, then `pnpm db:migrate`: **PASS**; direct verification confirms migration history, OWNER-only DB check and `audit_owner` policy. Security advisor found only existing intentional deny-all/no-policy INFO notices and the pre-existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); no new warning from this migration.
- Read-only verification using all three configured passwords: Supabase login **PASS**; `/me` is **200 only for Owner**, `/platform/me`, `/platform/users` and `/platform/audit` are **200 only for Superadmin**, other surfaces **403**. Owner context exposes two OWNER businesses; platform Users returns exactly the configured three profile IDs. Real Data API RLS returns the two businesses only for Owner and zero for Superadmin/Customer. Personal account status/roles were not mutated by verification.
- Short direct browser smoke **PASS**: configured Superadmin login → live console/three-profile Users list without old-role selector; configured Owner login → dashboard without permission counts → Owner access drawer with User ID only and no role selector; Escape returns focus correctly; configured Customer login → explicit access-denied copy saying renter portal is not implemented. QA signed out and closed its temporary tab; no screenshots, matrix or report artifact was generated. This also resolves the earlier Stage 9 browser-access blocker for the checked flows; the original Stage 9 output remains historical as of its commit.
- Ran retired `pnpm db:seed` and `platform:seed`: both **refuse with expected exit 1**, before Auth creation; verified the database still contains exactly three requested accounts and zero example Auth emails afterward. Both credential files are Git-ignored. Existing dev Web **4000** PID **65129** / API **9000** watcher child PID **68686**, combined session **71742**, were reused and remain running as requested; no new server or unrelated process was started/stopped in this follow-up.

### Boundaries & Remaining

- Customer is a real Auth identity/profile for future use, not an implemented portal or permission grant. Current support UI labels ungranted profiles accurately rather than inferring Customer access. Superadmin remains read-only as previously implemented.
- Full historical real E2E and the new disposable-fixture remote lifecycle were **NOT RUN**; their types/lint were verified. Final Validation should run them explicitly and confirm exact-ID cleanup while preserving historical audits. Do not point mutating tests at named personal accounts.
- No staging/production account/schema operation, unrelated domain deletion, deployment or physical GPS onboarding occurred. GPS remains TEST. Shared-password setup follows the user's explicit development request; credentials stay outside Git and logs.

### Next-stage Handoff

- Build Customer Portal only when requested, with its own customer-identity linkage, tenant-safe API/RLS and restricted projections; never reuse Owner membership as a renter role.
- Preserve independent Superadmin/Owner authorization, last Owner and private-account/test-fixture boundaries. Continue a single implementation commit with this cumulative log for each requested change set.


## Stage 10 output

Input: `Stage_10_UI_Shell_and_Component_System.md`. Implemented 2026-10-23 on current `main`, reconciled baseline `ad4f04b94a418005a89a2cd6f09618b0a138938a` and the existing uncommitted header-profile UI change. Source and this output remain **uncommitted at the user's request**; no commit or push was made. When authorized, include them in this stage's single implementation commit; Git remains authoritative for its SHA.

### Delivered

- Replaced breadcrumb/duplicate header logo with a topbar BusinessSwitcher for Owner and an explicit **Platform Console** context for Superadmin. The selector lists supplied verified memberships, rejects unknown selections, retains the business cookie and full document reload, and lets NestJS revalidate active tenant access. Removed sidebar business context and fixed Logout. Retained navigation/settings, mobile backdrop, Escape/focus containment and preview boundaries.
- Responsive sidebar is **372px at ≥1440**, **280px at 1101–1439**, **248px at 1024–1100**, and a viewport-bounded overlay below 1024. Shared UserAccountMenu shows verified Auth email unless the backend profile has a real name rather than a role placeholder, with avatar initials and a secondary friendly role. Long text has bounded/truncated presentation and titles; mobile retains the avatar and exposes full identity in the menu. The menu includes a valid Overview link and Logout, keyboard navigation, outside/Escape close, focus return and existing sign-out pending/error handling. No Owner/Owner duplication remains.
- Rechecked only approved Canva **Rental Fleet OS `DAHY0Bey5gc`** and original mark `MAHY0DdEe94`. BrandLockup now renders its actual two-line wordmark **Rental Fleet / Operating System**, with one accessible product name, a 48px sidebar mark and 56px Login mark (48px mobile Login). Existing transparent asset/favicon are retained; typography uses the project font rather than claiming vector/font parity. The approved English Login headline/description remain unchanged. No Canva design was modified.
- Added shared FilterBar, SearchField, native DateInput and custom Select/Combobox presentation using existing tokens and no new dependency. Combobox supports searchable/empty/loading/disabled/selected states, Arrow/Enter/Escape/Tab and outside close; a bounded portal avoids clipping by panels. Retained native selects for compact forms and server-backed RecordPicker search/pagination. Vehicles/Devices, Rentals, Customers, Trips and platform Businesses/Users/Audit now reuse the shared filter pattern. Controls/buttons use consistent sizing/states; search has one border/focus surface. Clear explicitly resets native/custom drafts before navigation, including when applied filters already equal defaults. Existing primitives, Drawer, tables, badges and tabs are reused with shared styling; pagination now has labelled navigation and explicit button types.
- Diagnosed the reported Superadmin login failure without changing credentials or grants: password Auth succeeded, `/platform/me` returned **200**, while tenant `/me` correctly returned **403 TENANT_ACCESS_DENIED**. Generic `/login` previously always sent the platform-only account to `/app`. Generic login now selects the destination using trusted NestJS grant responses: tenant success → `/app`; only tenant denial probes independent platform access → `/superadmin`; no grants → access denied. Explicit allowlisted deep links stay exact. Unexpected API/network failures remain on the form; no email or Auth metadata becomes an authorization source. Updated current development instructions.

### Minimal Verification

- `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`: **PASS** on final source. `pnpm --filter web exec node --test test/auth-navigation.test.mjs`: **25/25 PASS**, including safe return paths, explicit deep links, Owner/Superadmin default selection, no-grant denial and fail-closed network/API cases. Existing Node module-type warning only. `git diff --check`: **PASS**.
- Focused live browser smoke **PASS**: plain Login → correct named Owner and Superadmin workspaces; platform has no tenant selector; account ArrowUp/Down, Escape/focus return, outside click and Logout; mobile navigation Escape/focus return; Vehicles status selection/apply writes the correct URL; searchable branch selection works. Switching Demo Rental B → A reloads, clears unapplied search/branch state, and shows only A's branch choice. Corrected and rechecked same-default draft reset and nested search border conflicts found during QA.
- Narrow responsive checks **PASS** at **1440 / 1024 / 390px**: platform shell and Vehicles page document width matched viewport, desktop sidebar widths were 372/248px, mobile sidebar collapsed and controls stayed within the page. This is a focused smoke, not a screenshot/viewport matrix. Synthetic unusually long account/business names were **not interactively tested**; truncation/max-width/title behavior was reviewed in source.
- Used existing development services initially; after the session interruption neither listener remained. Temporarily restarted owned `pnpm dev` session **24683**, Web **4000 PID 76936**, API **9000 PID 76948**, with watchers/CSS worker. Signed QA accounts out, closed temporary tabs and reset the browser viewport. Stopped the exact owned temporary process tree after verification; `lsof` confirmed 4000/9000 had no listeners and `ps` confirmed all six owned watcher/server/worker PIDs exited. No unrelated server or Digital Twin process was stopped.

### Boundaries & Remaining

- Frontend presentation and login destination selection only: no API payload/contract/domain rule, permission/grant, schema, seed, migration, password/account status, production setting or deployment change. Superadmin remains independently authorized/read-only; Customer still has no portal. GPS remains TEST and development previews remain development-only.
- Full historical E2E, production-preview HTTP regression, comprehensive accessibility/long-content/visual matrices and performance tests were **NOT RUN**; reserve them for Final Validation. No separate stage Markdown, copied input plan, screenshot artifact or QA manifest was added.

### Next-stage Handoff

- Review the uncommitted UI on both surfaces before authorizing the single Stage 10 implementation commit. Preserve root stage-output consolidation and verified identity/independent grant boundaries.
- Final Validation should cover unusual long names/emails, assistive technology, remaining form/native-select paths and historical tenant/platform workflows without mutating named personal accounts.


## Stage 10 output

Input: `Stage_10_Inter_Lucide_Design_System_Implementation.md`. UI continuation implemented 2026-10-23 on `main`, baseline `ad4f04b94a418005a89a2cd6f09618b0a138938a`, preserving the preceding uncommitted Stage 10 shell work and its historical output above. Changes remain **uncommitted under the user's earlier no-commit instruction**. When authorized, include this cumulative source/lockfile/output in the single Stage 10 implementation commit; no SHA-only follow-up is needed.

### Delivered

- Added global **Inter** through `next/font/google` with Latin/Vietnamese subsets, `display:swap` and `--font-inter`. Production build downloads/self-hosts the font successfully; no fallback asset was required. Shared controls, popovers, Login, maps and previews inherit the family. Semantic sizing is body **15px**, navigation **16px**, category labels **14px**, forms/tables **14–15px** and existing heading/helper scale, with tabular numbers. Preserved approved Canva mark and two-line brand lockup; no new brand artwork or second global font.
- Installed pinned **`lucide-react@1.61.0`** and updated the pnpm lockfile. Replaced handwritten UI SVG paths with a typed map preserving the 24 existing aliases plus moon/sun/logout, named imports and stroke width 2. Kept decorative icons hidden from assistive technology and retained functional button labels. Actual sidebar baseline was **18px**, so icons are now **20px**, exactly +2px; category/nav text also increase exactly +2px. Geographic/map/chart SVGs remain geographic/chart artwork. Shared empty icons use the 32px token.
- Added coherent semantic dark colors derived from the approved orange/neutral palette, including forms, cards, statuses, overlays, skeletons, schedules/queues and Leaflet controls. Split primary button fill from readable link accent in dark mode; core text/link/button/status contrast pairs exceed 4.5:1 by numerical check. Original geographic tiles retain their colors. A synchronous root-head script initializes the allowlisted local preference or system theme before body paint; ThemeSync follows system/storage changes across routes. Preference changes are local only and tolerate blocked storage.
- Account primary text is always authenticated email with role beneath. One menu serves Owner/Superadmin in exact order **Dark Mode → Cài đặt → divider → Đăng xuất**. Removed sidebar Settings, retained existing Settings routes and existing sign-out implementation/cookie handling. Added menuitem-checkbox semantics, keyboard focus order/return, outside/Escape close and fixed positioning with available-height clamping for long content/errors. Platform Settings remains explicitly unavailable under its existing authorization; no new settings domain was added.
- Desktop sidebar no longer independently scrolls. It remains sticky on tall windows; short desktop windows (height ≤860px) use the document scrollbar so navigation stays reachable. Mobile overlay may scroll when content requires it. Retained previous responsive sidebar widths, no-breadcrumb topbar, business selector/full tenant reload and mobile keyboard containment.
- Replaced generic initial placeholders with dashboard/list/detail/map skeleton shapes inside the existing protected layouts, including nested detail/device/map/new-rental boundaries. Platform fallback selects the correct shape and four overview cards. Added shared reserved pending status, restrained button spinner and reduced-motion support. Removed query-driven panel remounts while retaining tenant/resource identity; list/detail paging keeps scroll and old content during transitions with conflicting page actions disabled. Fixed the observed dashboard sibling-key collision using separate tenant-scoped map/rental keys.
- RecordPicker preserves only the last good snapshot for its exact business/path, labels errors/stale results, supports retry and aborts obsolete requests. GPS/Trip retain Leaflet instances across accepted filters/route pages, update bounds/layers without whole-map remounts, retain existing stale-response/polling/visibility cleanup, and show actual snapshot freshness during refresh. No positions are invented. Updated current development instructions; backend contracts and authorization behavior are unchanged by this continuation.

### Minimal Verification

- `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`: **PASS** on final code. Build successfully includes Inter and Lucide. `pnpm --filter web exec node --test test/theme-init.test.mjs test/auth-navigation.test.mjs`: **28/28 PASS** (three prepaint preference/storage-failure tests plus 25 existing landing/return-path checks); only the existing Node module-type warning. `git diff --check`: **PASS**.
- Focused browser/DOM smoke **PASS**, without screenshot capture: Login body and input computed Inter; Owner/Superadmin authenticated shells show email + role, correct menu action order, Dark Mode toggle, theme persistence after reload, themed Login after sign-out, Owner Settings navigation, keyboard Escape/focus return and menu Logout. Verified actual **16px navigation / 14px categories / 20px Lucide sidebar icons**, no sidebar Settings, no platform tenant selector and menu bounds within viewport.
- At a short **1280×520** desktop window, sidebar overflow was `visible`, positioning used the document fallback and document height included all 808px of navigation. Narrow **390×640** smoke had no horizontal page overflow; mobile drawer remained accessible with scrolling available only if needed. No screenshot matrix or broad responsive/performance validation was performed.
- Vehicles filter refresh was observed with **table + shell still mounted, `aria-busy=true`, inline pending text and zero initial-loading skeletons**. Final URL retained the submitted query. Full business switch B → A removed the unapplied draft, retained only URL-backed filters and rebuilt the authorized tenant context. GPS page rendered actual empty/freshness/TEST states without invented telemetry. Page-shaped initial skeleton sources/markup and error/retry/abort branches were reviewed and compiled; cold-load skeleton timing, injected network failures and nonempty retained-record races were **not interactively forced**.
- Reused existing Web **4000 PID 78262** and API **9000 PID 80056**; no server was started or stopped by this continuation. QA signed out, closed its temporary tab and restored the viewport. Existing user processes, credentials and account status/grants were untouched.

### Boundaries & Remaining

- No API/backend/contract/schema/migration/RBAC/Auth behavior, server setting, business theme preference, seed, account mutation or production deployment. The preceding Stage 10 login-landing fix is preserved. Superadmin remains independently authorized/read-only, Customer has no portal and GPS remains TEST.
- Full historical E2E, exhaustive accessibility/visual/performance matrices, instrumented first-paint flash measurement, forced failure/retry races, nonempty historical workflows and unusual long-content combinations remain **NOT RUN** for Final Validation. No extra stage Markdown, copied plan, screenshot file or QA manifest was created.

### Next-stage Handoff

- Review the accumulated uncommitted Stage 10 UI, then authorize its single implementation commit when ready; keep this root log with source and lockfile.
- Final Validation should exercise initial skeleton timing, retained nonempty results under failures/rapid requests, assistive technology/reduced motion, long account/business labels and short/mobile navigation, while preserving named personal accounts and tenant/platform boundaries.


### Stage 10 UI follow-up — fixed content scrolling and shell polish (2026-10-23)

- User-directed refinement after `Stage_10_Inter_Lucide_Design_System_Implementation.md`: the viewport is now a fixed app frame. Sidebar and topbar stay in place; only the labelled/focusable workspace content region and its footer scroll. Route path changes reset this region to the top; query changes preserve the existing filter/paging position. Standalone Login is not affected by app-only body locking.
- Separated the approved logo into a dedicated surface/divider aligned with the topbar. Removed the sidebar create-contract action (including its preview counterpart); existing create actions inside the Rentals screen remain. Menu-row padding increased exactly 50% from **9px/12px → 13.5px/18px**, with more generous category headers. At heights ≤960px, accessible category buttons open the current/selected group; exceptionally short menus can overflow inside their own bounded fallback without moving the logo/topbar or hiding actions.
- Refined account trigger and shared **320px** popover with accent initials, bounded email/role, identity summary/role badge, grouped icon rows and clear hover/focus/destructive styling. Kept Dark Mode → Cài đặt → divider → Đăng xuất order, one sign-out implementation, keyboard/outside/Escape behavior, focus return and measured viewport clamping. No account/auth/API/DB change.
- Focused verification: `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build` and `git diff --check` **PASS** on final source including the mobile-alignment adjustment. Browser confirmed body scroll remained **0**, content scrolled, topbar/sidebar stayed at **y=0**, logo/topbar aligned at **88px**, 50% menu padding and zero sidebar create actions. Account menu stayed visible and clickable over scrolled content, outside click closed it, route navigation reset content position, category controls switched groups, and mobile Escape returned focus. At **390×844**, page width matched viewport, mobile menu/account actions remained reachable and no horizontal overflow was observed. Mobile account menu measured **320px** and stayed fully inside the viewport; Logout returned to Login where body overflow restored to `visible`. QA signed out, closed its temporary tab and restored viewport sizing. Existing user Web **4000 PID 78262** / API **9000 PID 80056** were reused untouched; no server created, no commit/push, no screenshot/report artifact or broader E2E matrix.


## Stage 11 output

Input: `Stage_11_Commercial_Core_Implementation.md`, plus the direct request for one Login UI with server-side workspace selection. Implemented 2026-10-23 on current `main`, baseline **db5d82ab65** (`improve UI`). The checkout was clean on entry: prior Stage 10 changes had been committed by the user. This output, source, migration, contracts and focused tests belong to **this stage's implementation commit**; Git history is authoritative for its resulting SHA.

### Delivered

- Promoted `/app/commercial` from development preview to **LIVE Owner operations**: actual summary/list/search/date/category/status filters, stable pagination, empty/loading/error states and tenant-scoped Vehicle/Rental pickers. Added manual miscellaneous income, expenses, rental receipts, deposit receipt/refund/retention, immutable detail and reason-required reversal. Rental Detail reconciles contracted rent, recorded payments, outstanding/overpaid rent and actual deposit balances; Vehicle Detail links to its filtered Commercial view. Unsupported currency or an unavailable Commercial response leaves the existing Rental Detail usable with an explicit financial-panel fallback. Legacy rental deposit confirmation is explicitly operational and does not create a receipt. Shared Inter/Lucide controls, theme, fixed content-scroll shell, account menu and tenant reload remain intact.
- Added one CLI migration `20261023151103_commercial_core.sql` and Drizzle mapping for `commercial_movements`: exact positive whole-VND numeric amounts, bounded fields, tenant/vehicle/rental composite FKs, indexes, active Owner SELECT RLS and revoked browser writes. Rental links derive the vehicle; financial history prevents draft vehicle reassignment and business currency changes. Historical actor IDs survive profile removal. API/browser records cannot be edited/deleted; corrections insert one matching opposite-effect reversal, without reversal chains. Trusted database maintenance retains administrative control.
- Owner-only `commercial.read/manage` protect create/list/detail/reverse, business/vehicle/rental summary and rental financial summary endpoints. Writes lock the business, recheck current active profile/business/membership/permission and atomically insert redacted audit events. Cross-tenant IDs are never usable as grants; independent Superadmin and deferred Customer receive no financial access. Chronological deposit prefix checks reject over-refund/retention, invalid backdating and corrections creating negative liability. Future occurrence dates are rejected.
- Commercial API amounts are integer strings up to **999999999999999** per entry; SQL numeric/BigInt preserve exact totals beyond JavaScript safe integers. Existing Rental Core decimals are compared using exact whole-VND half-up rounding. Contracted rent/required deposits and the legacy confirmation flag never count as receipts. Basis **RECORDED_MOVEMENTS**: revenue includes payments + miscellaneous + retained deposits; operating cash excludes deposits and noncash retention; estimated profit subtracts recorded expenses and excludes unrecorded costs. Deposit held is cumulative through `until`, independent of `from`; period revenue/expenses use `[from,until)`. Reversals affect their own correction date. Category/status/search filter only the list, as labelled.
- One **shared Login** form/copy for every account: removed role-specific login links. After Supabase Auth, `/auth/continue` validates identity and checks independent NestJS grants on the server, then redirects to the authorized workspace. Safe deep links are retained only after the corresponding grant succeeds; stale role-specific hints fall back to the actual available workspace. Both denials reach access denied; unexpected API/network failures fail closed. No email, metadata or UI selection determines authorization. Tenant and platform guards continue to authorize every protected request.
- Updated generated OpenAPI/TypeScript contracts, concise README and current development instructions. Applied only the verified development Supabase migration; no staging/production change.

### Minimal Verification

- `pnpm --filter api typecheck`, `pnpm --filter api lint`, `pnpm --filter api build`: **PASS**. `pnpm --filter api exec vitest run src/commercial src/auth/permissions.spec.ts src/rentals/rental.service.spec.ts src/database/commercial-migrations.spec.ts src/database/migrations.spec.ts`: **54/54 PASS**, including exact arithmetic, rounding, chronological deposit balance, correction periods, tenant isolation, Owner permissions, currency/vehicle history guards, audit rollback and clean migration/RLS replay.
- `pnpm openapi`: **PASS**; exported without an HTTP listener. `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`: **PASS**. `node --test apps/web/test/auth-navigation.test.mjs`: **26/26 PASS**, including hostile URLs, authorized deep links, root query strings, stale role hints and fail-closed grant errors. Only the existing Node module-type warning. `git diff --check`: **PASS**.
- `pnpm db:migrate --dry-run` then `pnpm db:migrate`: **PASS** on verified active dev project **eeryymswcufnebibigqf**. Read-only inspection confirmed history version **20261023151103**, RLS enabled, one Owner read policy and only authenticated SELECT privilege. Post-migration security advisors had no new findings: the three existing intentional deny-all tables and existing leaked-password protection warning remain unchanged.
- `pnpm --filter api exec vitest run --config vitest.config.e2e.ts test/commercial.e2e-spec.ts`: **1/1 PASS** against real development Supabase. Disposable exact-owned fixtures covered six movement kinds, rental rounding/outstanding reconciliation, correction/over-refund rejection, pagination, cross-tenant detail/summary, platform/disabled/no-membership denial, rental vehicle lock, redacted audit and direct Data API read/write isolation. Cleanup passed: operational rows and temporary Auth identities removed; audit-bearing disabled business tombstones and historical audit remain. Named personal accounts were not modified.
- Focused browser smoke **PASS**, without screenshot capture: identical Login for generic/platform/tenant return hints; named Owner entering a stale platform hint landed at `/app`; named Superadmin entering a stale tenant hint landed at `/superadmin` and loaded live platform data. Owner Commercial loaded real zero/empty results, correct recorded-money labels, actions and the labelled manual-expense drawer; account menu/logout remained functional. Signed QA accounts out and closed the owned QA tab. Reused user-owned Web **4000 PID 78262** and API **9000 PID 91285** (watcher child at final check), without starting/stopping servers or touching Digital Twin.

### Boundaries & Remaining

- No payment gateway, banking transaction, VETC synchronization, invoices/VAT, full accounting, advanced pricing, payroll, Customer portal or platform financial writes. Manual toll expenses do not imply provider integration. GPS remains **TEST**; synthetic previews remain development-only.
- Broader historical E2E, production preview HTTP regression, browser posting of nonempty disposable finance fixtures, exhaustive accessibility/viewport/performance matrices and forced network races were **NOT RUN**; reserve comprehensive coverage for Final Validation. No screenshot, QA manifest, copied plan or separate stage report was added. Existing leaked-password protection limitation remains documented in the development runbook.

### Next-stage Handoff

- Extend from the exact recorded-movement model and immutable corrections; preserve tenant locks/RLS/audit, explicit deposit liability, exact VND arithmetic and disposable test cleanup. Review currency conversion as a separate domain before supporting other currencies.
- Choose VETC/toll readiness or operational alerts from actual priorities; retain one shared Login and independent server-side grants. Final Validation should cover full historical workflows and broader UI/error/accessibility behavior without mutating named accounts.


## Stage 12 output

Input: `Stage_12_Operational_Alerts_and_UX_Refinement.md` plus the direct request to standardize date, dropdown, text fields and reusable dialogs. Implemented 2026-10-23–24 on clean `main`, baseline **eb0e9b2**. Source, generated contracts, focused tests and this output form **this stage's implementation commit**; Git history is authoritative for its SHA.

### Delivered

- Desktop sidebar now fits all live navigation labels/icons/badges within **270–310px**, with a persistent intrinsic sizing guide so collapsed categories/routes do not change its width. Browser measured **282.9px**, equal **12px** left/right menu insets, aligned row/logo/category starts and no normal desktop menu scrolling. Fixed topbar/content-only scrolling and mobile overlay remain; shorter desktops reduce row spacing, with a hidden-scrollbar accessibility fallback only at extremely short heights ≤420px.
- Added reusable centered **FormDialog** (800/940px) and compact **ConfirmDialog** (480px), with bounded mobile layouts, scrollable body, persistent header/footer and shared DialogActions. Migrated Commercial, Rental actions, Vehicle/Device/Assignment, Customer, Owner access and Branch editors; the multi-step Rental Wizard now renders on its own page. Preserved API validation, exact-money behavior, permissions and pending/errors. Named-control changes plus external picker state trigger same-modal unsaved confirmation; guarded Cancel/Escape/backdrop, pending protection, beforeunload and focus return are shared.
- Standardized live text fields/selects/date inputs across shared primitives, forms, filters, Business, Settings and GPS. Themed custom selection supports keyboard/typeahead; calendar/date-time supports day/month/keyboard selection, bounds, clear/today/time and Vietnamese validation. Native bridges retain FormData, required constraints, value/defaultValue/change/reset behavior and existing Vietnam-time conversion. Popups use the closest dialog's top layer, avoiding inert/clipped controls. No dependency added.
- Added **LIVE read-only Owner Alerts** API/page/sidebar entry: ACTIVE overdue returns, returns due in 24 hours and stale actual current-assignment GPS **TEST** fixes (>120 seconds; critical >600 seconds). No-data/unassigned/ended/future/inactive GPS conditions do not fabricate alerts. One database timestamp drives bounded pagination, counts and severity/time ordering; guards and SQL recheck tenant Owner/profile/business access. Filters, scoped counts, entity links, visible-tab refresh, loading/empty/error states use actual API data. No acknowledgment state or migration was needed for this derived inbox.

### Minimal Verification

- `pnpm --filter api typecheck`, `pnpm --filter api lint`, `pnpm --filter api build`: **PASS**. `pnpm --filter api exec vitest run src/alerts src/auth/guards.spec.ts src/auth/permissions.spec.ts src/commercial/domain.spec.ts`: **28/28 PASS**, including production alert SQL in PGlite, time rules, current assignment/tenant isolation, filters/counts/pagination, active Owner boundaries and exact-money regression. `pnpm openapi`: **PASS**, without starting an HTTP listener.
- `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`: **PASS**. `node --test apps/web/test/date-control.test.mjs`: **4/4 PASS** (calendar/leap/year boundaries and date/time constraints); existing Node module-type warning only. `git diff --check`: **PASS**.
- Focused browser smoke **PASS** against existing dev services: live empty Alerts and GPS filter URL/results; stable sidebar width across pages/category changes; 940px centered Commercial editor with contained scroll/footer; dropdown selection and datetime changes matched native bridge values; Escape closed only the calendar; Cancel/keep/discard retained or removed the draft and returned focus; Rental Wizard stayed full-page and required date errors were Vietnamese with first-invalid focus. No operational data was posted. Signed QA out/closed its owned tab. Reused user-owned Web **4000 PID 78262** and API **9000 PID 96133** (final watcher child); no server was started/stopped or Digital Twin touched.

### Boundaries & Remaining

- No schema/remote data/account/grant mutation, staging/production migration, push/email, cron, VETC, billing or Customer portal. GPS remains TEST; timestamp staleness is not proof of physical connectivity. Preview-only raw controls/read-only drawers and the Trip range slider remain outside the live editing migration.
- Full historical E2E, nonempty online alert fixtures, production preview HTTP regression, exhaustive accessibility/viewport/theme matrices, forced pending/network races and dirty browser-back behavior were **NOT RUN**, reserved for Final Validation. No screenshots, QA manifest or separate stage report created.

### Next-stage Handoff

- Reuse shared FormDialog/ConfirmDialog and field primitives for future live forms; preserve guarded close, native form semantics, modal popup ownership and tenant API authorization. Keep alerts derived unless a concrete acknowledgment/history workflow justifies tenant-safe state and audited writes.
- Final Validation should exercise remaining nonempty workflows, small/short viewports, assistive technology, browser navigation with drafts and network failures without mutating named personal accounts.


## Stage 13 output

Input: `Stage_13_Preview_to_Live_UI_Implementation.md`. Implemented 2026-10-24 on clean `main`, baseline **b6850f0**. Source, focused tests and this output form **this stage's implementation commit**; Git history is authoritative for the resulting SHA. The user explicitly requested pushing after commits; that standing preference is recorded in AGENTS/development guidance and this commit is delivered to the configured remote without force-pushing.

### Delivered

- Applied the preview hierarchy to **LIVE Owner Overview**: compact real map/list + four shared KPI cards, followed by a Vietnam-time rental timeline and active/overdue queue cards. Existing tenant APIs supply exact total metadata, at most six rentals per schedule/queue page and twenty location rows. Availability is explicitly an advisory next-24-hour interval; timeline day/seven-day bars clip actual current-page rentals and never imply fleet capacity from blank space. Retained overdue filtering, pagination, detail links, map polling/cancellation and tenant-keyed reset.
- Applied the **LIVE Superadmin overview** composition: real KPI cards, bounded business-health table, latest platform audit activity, attention summary and GPS freshness breakdown. It reads existing independently authorized overview + first six businesses + latest six audit records, with subset/total/time-window labels. Businesses/Users/Audit and details share clearer identities/tables/statuses; health uses actual assigned/unassigned counts and GPS TEST timestamp states. Unsupported Features/Integrations/Settings/writes remain unavailable; platform receives no tenant financial access.
- Extracted data-free **MetricCard/RecordIdentity** presentation, reused MetricCard in both reference previews and live dashboards/Commercial/Alerts. Standardized headers, filters, table/empty/pagination/health visuals and entity cells across live Vehicle/Rental/Customer/Trip lists and details. Removed obsolete duplicated KPI/sparkline/old-dashboard CSS. Preserved Inter/Lucide/tokens, light/dark, centered forms/dialogs, account/business menus, intrinsic equal-padding sidebar and fixed header/content-only scrolling. Development previews remain labelled references, with no fixture imports in live graphs or fabricated trends/coordinates/revenue.

### Minimal Verification

- `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`: **PASS**. `node --test apps/web/test/live-presentation-boundaries.test.mjs apps/web/test/dashboard-schedule.test.mjs`: **8/8 PASS** for transitive live-route/fixture separation, presentation-only imports, Vietnam-day boundaries, exact interval clipping and half-open/overnight schedule behavior. Existing Node module-type warning only. `git diff --check`: **PASS**.
- Focused browser smoke **PASS** using existing services: real empty Owner KPIs/map/schedule/queue, map/list toggle, overdue URL filter, mobile navigation and live Vehicle form opening/Escape; real Superadmin business health + six audit events, dashboard-to-Audit fixed-window deep link, business list/detail. Audit pagination retained **20 rows**, `aria-busy=true` and **zero initial skeletons** while refreshing. Sidebar remained **282.9px** and topbar at y=0. At **390×844**, Owner/Superadmin page widths matched viewport; Owner KPI stacking and **366px** form remained usable. Light/dark switching worked; restored original dark presentation and default viewport, signed QA out and closed the temporary tab.
- Reused user-owned Web **4000 PID 78262** and API **9000 PID 96133**; no server was started/stopped or Digital Twin touched. No operational test records, account status/password/grants or schema changed. Existing platform reads continue to produce their authorized audit records.

### Boundaries & Remaining

- UI composition/presentation only: no API/domain/contract/Auth/RLS/schema/GPS-ingress/financial-rule change or migration. Customer portal and unsupported platform writes remain deferred; GPS stays TEST. No new preview routes, screenshots, separate stage report or QA manifest.
- Full historical E2E, production-preview HTTP regression, nonempty online Owner rental/GPS workflows, exhaustive responsive/accessibility/error/performance matrices and computed dynamic-import analysis were **NOT RUN**; retain them for Final Validation. Static boundary checks cover current literal import/reexport graphs, not arbitrary runtime-generated paths.

### Next-stage Handoff

- Reuse the shared live presentation and actual API metadata; preserve explicit bounded-list scope, independent platform grants, exact financial formatting and tenant reset. Add new aggregation contracts only when a real widget needs them; never replace unavailable values with preview fixtures.
- Continue one implementation commit with this cumulative output and push after committing unless the user explicitly requests otherwise. Final Validation should exercise nonempty operations, rapid filter/tenant transitions and remaining failure/accessibility states without mutating named accounts.


### UI follow-up — topbar and account menu (2026-10-24)

- **Delivered:** On baseline **68107e8**, shared WorkspaceContext now gives live and preview topbars the same compact icon/name alignment; the Owner business selector no longer looks like a wide form field. Preserved membership validation/full document reload, fixed topbar and approved sidebar dimensions. Account trigger uses a neutral Lucide user avatar instead of email initials, with shared preview/live geometry and avatar-only mobile display. The menu groups signed-in identity, Owner-only real business settings, appearance/current dark-mode state and separated sign-out; unavailable Platform Settings is omitted. No profile editor or fake account actions were introduced.
- **Minimal Verification:** `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build` **PASS**. `node --test apps/web/test/live-presentation-boundaries.test.mjs`: **3/3 PASS**. Focused browser checks passed for Owner/Superadmin menu options, default avatar, keyboard End/Escape and focus return, outside click, Owner Settings navigation, theme toggle/restoration and sign-out. At **390×844**, document width remained **390px** and both 320px popovers stayed inside the viewport. Desktop live/preview topbars stayed at **88px**, context rows **44px**, account rows **50px**, sidebar **282.9px**. Restored dark theme/default viewport, signed QA out and closed the temporary tab. Existing user-owned Web **4000 PID 78262** / API **9000 PID 96133** reused; no server started or stopped.
- **Boundaries & Remaining:** UI only; no API/schema/auth/authorization/account-data mutation, migration, new tests, screenshots or report files. Business selector opening/Escape was checked; actual tenant switching was not repeated because its unchanged validated-ID/reload handler remains intact. Broader accessibility/responsive/E2E matrices remain Final Validation work.
- **Handoff:** Changes remain **local and uncommitted**, as explicitly requested by the user; **no commit or push** was performed for this follow-up.


### UI follow-up — primary actions, expanded navigation and field focus (2026-10-24)

- **Delivered:** Added leading shared Lucide icons to missing live primary creation, rental wizard/lifecycle, save, search and retry actions; Login now places its existing arrow before the label. Shared DialogActions accepts a typed action icon (default check) and uses only its spinner while pending. Categories are permanently expanded headings across Owner/Platform and desktop/mobile; removed accordion state/listeners/hidden navigation. Responsive row heights and a bounded fallback keep all links reachable with the logo/topbar fixed. BusinessSwitcher fills the remaining header width without a maximum or ellipsis; long selected names wrap. Shared field focus/open state uses one orange edge aligned with the field (border + inset shadow), with no pale exterior ring/offset; invalid states retain the danger color and non-field focus is preserved.
- **Minimal Verification:** `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build` **PASS**. `node --test apps/web/test/live-presentation-boundaries.test.mjs`: **3/3 PASS**. Browser verified leading icon on Tạo hợp đồng; all **12 Owner navigation links** open at **1280×720** with menu client/scroll height both **583px**; BusinessSwitcher expanded to **637px**, max-width none and selected text not ellipsized. Login input, search, Combobox, business selector and Date trigger all computed outline none / offset 0 / inset-only focus shadow. At **390×844**, both navigation groups remained expanded, page width stayed 390px, business selector used the available **244px** and the selected name fitted. Mobile Escape restored focus; default viewport restored, signed QA out and closed its tab. `git diff --check` **PASS**.
- **Boundaries & Remaining:** Preserved previous local topbar/avatar/account-menu changes. No domain/API/schema/auth/permission/account-data mutation, operational record creation, migration, screenshot, new test or separate report. User-owned Web **4000 PID 78262** / API **9000 PID 96133** reused without starting/stopping services. Broad historical E2E, exhaustive viewport/accessibility checks and every nonempty action remain Final Validation work.
- **Handoff:** All follow-up changes remain **local and uncommitted** per the user's standing instruction for this UI review. **No commit or push** performed.
