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
