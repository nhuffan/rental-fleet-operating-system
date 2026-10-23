# Development

## Run and verify

Use pnpm 11.19.0; project scripts select Node 24.21.0. Copy apps/web/.env.example to apps/web/.env.local and apps/api/.env.example to apps/api/.env on a new checkout. Supply real values locally only.

```sh
pnpm install --frozen-lockfile
pnpm dev                 # Web :4000, API :3001; Ctrl+C stops both
pnpm build
pnpm lint
pnpm typecheck
pnpm test                # permissions and clean-database migration replay
pnpm test:e2e            # real dev Auth/API/RLS tests; requires demo seed
pnpm openapi             # after API build; exports spec and generated types
```

Local Web: `http://localhost:4000` (fixed by both `dev` and `start` scripts). Local API: `http://127.0.0.1:3001`; `WEB_ORIGIN=http://localhost:4000`. Keep these values in the local env files aligned with their examples. API and Web use separate ports.

API: /api/v1. Swagger: /api/docs; JSON: /api/openapi.json (disabled in production). API errors contain statusCode, code, message, requestId. Lists accept page (default 1), limit (default 20, maximum 100). Dates are UTC ISO strings.

## Database and demo login

Drizzle is the query layer. SQL migrations in supabase/migrations are the sole schema source of truth; schema.ts maps the query types. Create files with `supabase migration new descriptive_name`, test with `pnpm test`, then `pnpm db:migrate`. The migration command checks SUPABASE_PROJECT_REF against SUPABASE_URL, links that project, and uses Supabase migration history. Supabase CLI must be installed and authenticated. Preview migrations with `pnpm --filter api db:migrate --dry-run`.

DATABASE_URL is the PostgreSQL URI from Connect → Session pooler, with a URL-encoded password and no placeholder brackets. The database client verifies TLS using infra/certs/supabase-ca.crt (public CA downloaded from the Supabase Dashboard); override DATABASE_CA_PATH if the deployment uses another CA. Never disable certificate verification.

On a development project only, set APP_ENV=development, ALLOW_DEMO_SEED=true and a working server key in SUPABASE_SECRET_KEY, then run `pnpm db:seed`. It creates two demo businesses and role-specific test users without sending email. Login details live only in ignored `.env.demo.json` at the repository root; use accounts.ownerA.email/password to log in. Seed is repeatable and does not reset existing users or data. Tests add temporary records and clean them up; audit records remain as security evidence. Use only disposable demo tenants for integration tests.

Production users are created in Supabase Auth by an administrator. An OWNER/ADMIN adds their known Auth User ID through the membership UI; there is no automatic email invite. An OWNER can assign elevated roles. Demo accounts must never be seeded into staging/production.

## Architecture and security

- Web uses per-request Supabase SSR clients, cookie refresh in proxy.ts, and protected server layouts. It forwards access tokens to NestJS. Browser code uses only the publishable key.
- NestJS verifies each bearer token against Supabase Auth, then checks active profile/business/membership. Optional X-Business-Id selects one of the user's active memberships; otherwise the oldest active membership is used. Frontend tenant selection is never trusted by itself.
- OWNER manages all roles; ADMIN manages operations memberships and business/branch/settings data; OPERATIONS reads business/branches/settings and the Fleet vehicle/device registry; Fleet and Customer/Rental writes require OWNER/ADMIN; OPERATIONS reads customers/rentals/availability. The last active owner cannot be disabled or demoted through the API. Guards and transaction rechecks enforce this independently of the UI.
- Every tenant query is scoped. Writes and audit events share a transaction; a business row lock serializes tenant admin changes. Audit metadata contains changed field names and request IDs, not passwords/tokens.
- RLS permits only membership-scoped Data API reads; direct writes by anon/authenticated are revoked. No SECURITY DEFINER helper is used. The API uses a trusted DB connection and must always enforce its own authorization.
- Shared API contracts are under packages/contracts. Database schema and API env are server-only. Fleet Core implements tenant-scoped vehicles, GPS device registration and assignment history. Customer/Rental Core implements reservations, handover/return, extensions, derived availability and overdue. GPS PoC adds authenticated Traccar TEST ingestion and indexed latest-position reads; see [GPS PoC](gps-poc.md).

## Staging

Use an independent Supabase project and run the same migrations with its env. Supply .env.staging.api and .env.staging.web at the root (both ignored); use the app env examples as a starting point. Set APP_ENV=staging, WEB_ORIGIN to the HTTPS Web origin, public API/Supabase URLs and the staging database credentials. Do not run demo seed.

```sh
docker compose --env-file .env.staging.web -f compose.staging.yaml up --build -d
docker compose --env-file .env.staging.web -f compose.staging.yaml down
```

The Dockerfile has separate api/web targets; Web listens on port 4000 and API on 3001. NEXT_PUBLIC_* values are public build arguments; secrets are runtime env only and excluded from the build context. Put an HTTPS reverse proxy in front of the loopback-bound ports. Configure Supabase Auth Site URL/redirect allowlist for that Web origin. No staging cloud project is created automatically.

Supabase leaked-password protection requires Pro or above; it is unavailable on the current Free project ([documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

## Web UI and development previews

The web UI uses shared semantic tokens under `apps/web/src/styles`, scoped components under `components`, and feature-specific SaaS Core pages under `features`. Existing `/app` URLs and API payloads are unchanged. Mutation types come from the generated OpenAPI schemas. A business switch reloads the document so local form/list state cannot survive into another verified tenant context.

While `next dev` is running, `/dev-preview/business` and `/dev-preview/platform` display clearly labelled, historical synthetic fixtures. Core component examples in that area are read-only. `/superadmin` redirects to the platform design preview only during development. All design preview routes return 404 in production; they cannot grant platform access. Fleet preview routes within `/app` still pass through the existing tenant auth layout/proxy.

Production release-boundary regression tests require a temporary production server and use only unauthenticated localhost requests:

```sh
pnpm --filter web build
# Stop the dev server first; start a server only with user authorization and stop it after verification.
pnpm --filter web start --hostname 127.0.0.1
UI_TEST_BASE_URL=http://localhost:4000 node --test apps/web/test/preview-boundaries.mjs
```

If the host sandbox prevents Turbopack's CSS worker from opening its internal port, `pnpm --filter web exec next build --webpack` verifies the production output without changing the pinned Next.js version or default build script. See `docs/ui-screen-inventory.md`, `docs/ui-design-tokens.md` and `docs/ui-backend-readiness.md` for current UI boundaries.

## Fleet Core

`/app/vehicles`, `/app/vehicles/devices` and `/app/vehicles/:id` are live server-authorized pages in all environments. Vehicle lifecycle is `ACTIVE` / `INACTIVE`; rental availability is derived separately by Rental Core. Devices are registry records, not online/offline telemetry. Synthetic development-only Fleet design previews remain separate from live pages.

OWNER/ADMIN have `vehicle.read`, `vehicle.manage`, `gps.read`, `gps.manage`; OPERATIONS has the two read permissions. Device assignment/end requires `vehicle.manage`. Vehicle/device writes and audit events share a transaction after taking the same tenant business-row lock used by SaaS Core and rechecking the current membership/profile/business/permission.

License plates are uppercased with whitespace/dot/hyphen removed, then validated as 4–16 ASCII letters/digits. A plate is unique within the business, including inactive vehicles. GPS `provider` is lowercase and `deviceUid` is trimmed but case-sensitive; the pair is globally unique with immutable business ownership and identity. PATCH can change only device label/status. Branches must belong to the verified tenant and be active when newly associated.

A vehicle and device can each have at most one current primary assignment. End the active assignment before disabling either resource or replacing its device. Assignment/end timestamps use the database clock; ended rows remain in history. There are no hard-delete or cross-business transfer APIs. See `docs/fleet-core.md` and the source stage plan under `docs/stages`.

Fleet E2E uses only the existing seeded development project `eeryymswcufnebibigqf`, creates uniquely named disposable records and removes only those records afterward; audit evidence remains. E2E suites run serially because SaaS Core tests exercise revocation of shared demo accounts. Never run these suites against staging/production.


## Customer and Rental Core

`/app/customers`, `/app/customers/:id`, `/app/rentals` and `/app/rentals/:id` are live tenant-authorized pages. Dashboard schedule/active queue and Vehicle Detail current/next rental use real Rental API data. Fleet Map, dashboard GPS and Vehicle Detail use real GPS ingestion data labelled TEST; Trips, Commercial and platform administration remain development previews.

OWNER/ADMIN have `customer.read`, `customer.manage`, `rental.read`, `rental.manage`; OPERATIONS has the two read permissions. All lifecycle actions require `rental.manage` and recheck authorization under the same Business lock used by SaaS/Fleet Core. Customer contact data/notes never enter audit metadata.

Lifecycle: DRAFT → RESERVED → ACTIVE → COMPLETED; DRAFT/RESERVED → CANCELLED. Handover and Return record validated timestamps/odometers. OVERDUE derives from ACTIVE + elapsed end time and is never a stored workflow status. Drafts do not hold a vehicle. Reserve/Extend check half-open UTC intervals `[startAt,endAt)`, backed by PostgreSQL GiST exclusion using `btree_gist` installed in the `extensions` schema. A partial unique index prevents two ACTIVE rentals per vehicle even after one becomes overdue. An overdue unreturned vehicle is unavailable until returned. Vehicle lifecycle remains ACTIVE/INACTIVE.

Customers need a name and at least phone/email; contacts may be shared and are nonunique. Use disable rather than hard-delete; customers and vehicles with RESERVED/ACTIVE rentals cannot be disabled. Amount/deposit inputs use at most two decimal places; depositReceived is only a simple flag, not a ledger. See [Rental Core policies/API](rental-core.md).

`pnpm test:e2e` includes a separate Customer/Rental suite restricted to `eeryymswcufnebibigqf`. It checks real lifecycle, competing reservation requests, extension conflicts, overdue, cross-tenant IDs, RBAC and direct Data API RLS/write denial. It deletes only recorded suite-owned domain IDs and retains audit records. Never seed or run these tests on staging/production.

## GPS PoC and map

`/app/fleet-map`, dashboard GPS and Vehicle Detail read tenant-authorized current locations in all environments. The only implemented source is Traccar TEST feed, labelled TEST in storage/UI; no physical device is verified. Registry ACTIVE/assignment alone never means online. The current-state equivalent uses the latest recorded fix of the active assignment, with first receipt breaking equal-time ties; historical delayed packets cannot replace a newer fix. Fresh ≤120s, stale ≤600s, then offline; no assignment/no packet have separate states.

Configure optional server-only `GPS_TRACCAR_TOKEN` (at least 32 random characters) in `apps/api/.env`; empty disables ingestion. The authenticated integration endpoint is `/api/v1/integrations/traccar/positions`. Browser code never receives this secret. `GET /fleet/locations` is filtered/paginated and `GET /vehicles/:id/location` returns one current projection; both require `gps.read`. RLS and revoked Data API privileges prevent direct telemetry reads/writes. The map polls every 20s after a request completes, pauses when hidden, and never downloads history. Leaflet 1.9.4/OpenStreetMap needs no token and retains attribution.

The reproducible development-only `pnpm --filter api gps:poc --uid=TEST-your-device` uses official pinned Traccar in Docker, temporary loopback port 5055 and a previously registered/assigned TEST device. It checks duplicate/delayed packets and removes its own container/config on completion, failure, SIGINT or SIGTERM. It retains TEST positions attached to that chosen assignment. Retention is an explicit tenant-bounded command, default dry-run, max 1000 rows: `pnpm --filter api gps:retention --business=<uuid>`; add `--apply` to delete eligible history. Thirty-day history is based on received time, retaining the latest point for each active assignment. See [GPS contract, security, reproduction and limits](gps-poc.md).

Shared typography uses body 15px/1.55, navigation 14px, forms/tables 14px, section titles 17px, page titles 28px, helpers/badges 12px. Login uses the same tokens/components and Supabase password sign-in, then clears the business cookie and replaces `/app` without a competing refresh. Both preview domains share these styles and retain their existing production 404 boundary.
