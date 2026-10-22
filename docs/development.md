# Development

## Run and verify

Use pnpm 11.19.0; project scripts select Node 24.21.0. Copy apps/web/.env.example to apps/web/.env.local and apps/api/.env.example to apps/api/.env on a new checkout. Supply real values locally only.

```sh
pnpm install --frozen-lockfile
pnpm dev                 # Web :3000, API :3001; Ctrl+C stops both
pnpm build
pnpm lint
pnpm typecheck
pnpm test                # permissions and clean-database migration replay
pnpm test:e2e            # real dev Auth/API/RLS tests; requires demo seed
pnpm openapi             # after API build; exports spec and generated types
```

API: /api/v1. Swagger: /api/docs; JSON: /api/openapi.json (disabled in production). API errors contain statusCode, code, message, requestId. Lists accept page (default 1), limit (default 20, maximum 100). Dates are UTC ISO strings.

## Database and demo login

Drizzle is the query layer. SQL migrations in supabase/migrations are the sole schema source of truth; schema.ts maps the query types. Create files with `supabase migration new descriptive_name`, test with `pnpm test`, then `pnpm db:migrate`. The migration command checks SUPABASE_PROJECT_REF against SUPABASE_URL, links that project, and uses Supabase migration history. Supabase CLI must be installed and authenticated. Preview migrations with `pnpm --filter api db:migrate --dry-run`.

DATABASE_URL is the PostgreSQL URI from Connect → Session pooler, with a URL-encoded password and no placeholder brackets. The database client verifies TLS using infra/certs/supabase-ca.crt (public CA downloaded from the Supabase Dashboard); override DATABASE_CA_PATH if the deployment uses another CA. Never disable certificate verification.

On a development project only, set APP_ENV=development, ALLOW_DEMO_SEED=true and a working server key in SUPABASE_SECRET_KEY, then run `pnpm db:seed`. It creates two demo businesses and role-specific test users without sending email. Login details live only in ignored `.env.demo.json` at the repository root; use accounts.ownerA.email/password to log in. Seed is repeatable and does not reset existing users or data. Tests add temporary records and clean them up; audit records remain as security evidence. Use only disposable demo tenants for integration tests.

Production users are created in Supabase Auth by an administrator. An OWNER/ADMIN adds their known Auth User ID through the membership UI; there is no automatic email invite. An OWNER can assign elevated roles. Demo accounts must never be seeded into staging/production.

## Architecture and security

- Web uses per-request Supabase SSR clients, cookie refresh in proxy.ts, and protected server layouts. It forwards access tokens to NestJS. Browser code uses only the publishable key.
- NestJS verifies each bearer token against Supabase Auth, then checks active profile/business/membership. Optional X-Business-Id selects one of the user's active memberships; otherwise the oldest active membership is used. Frontend tenant selection is never trusted by itself.
- OWNER manages all roles; ADMIN manages operations memberships and business/branch/settings data; OPERATIONS reads business/branches/settings and the Fleet vehicle/device registry; Fleet writes require OWNER/ADMIN. The last active owner cannot be disabled or demoted through the API. Guards and transaction rechecks enforce this independently of the UI.
- Every tenant query is scoped. Writes and audit events share a transaction; a business row lock serializes tenant admin changes. Audit metadata contains changed field names and request IDs, not passwords/tokens.
- RLS permits only membership-scoped Data API reads; direct writes by anon/authenticated are revoked. No SECURITY DEFINER helper is used. The API uses a trusted DB connection and must always enforce its own authorization.
- Shared API contracts are under packages/contracts. Database schema and API env are server-only. Fleet Core implements tenant-scoped vehicles, GPS device registration and assignment history. Rental and GPS ingestion/location domains are not implemented yet.

## Staging

Use an independent Supabase project and run the same migrations with its env. Supply .env.staging.api and .env.staging.web at the root (both ignored); use the app env examples as a starting point. Set APP_ENV=staging, WEB_ORIGIN to the HTTPS Web origin, public API/Supabase URLs and the staging database credentials. Do not run demo seed.

```sh
docker compose --env-file .env.staging.web -f compose.staging.yaml up --build -d
docker compose --env-file .env.staging.web -f compose.staging.yaml down
```

The Dockerfile has separate api/web targets. NEXT_PUBLIC_* values are public build arguments; secrets are runtime env only and excluded from the build context. Put an HTTPS reverse proxy in front of the loopback-bound ports. Configure Supabase Auth Site URL/redirect allowlist for that Web origin. No staging cloud project is created automatically.

Supabase leaked-password protection requires Pro or above; it is unavailable on the current Free project ([documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

## Web UI and development previews

The web UI uses shared semantic tokens under `apps/web/src/styles`, scoped components under `components`, and feature-specific SaaS Core pages under `features`. Existing `/app` URLs and API payloads are unchanged. Mutation types come from the generated OpenAPI schemas. A business switch reloads the document so local form/list state cannot survive into another verified tenant context.

While `next dev` is running, `/dev-preview/business` and `/dev-preview/platform` display clearly labelled, historical synthetic fixtures. Core component examples in that area are read-only. `/superadmin` redirects to the platform design preview only during development. All design preview routes return 404 in production; they cannot grant platform access. Fleet preview routes within `/app` still pass through the existing tenant auth layout/proxy.

Production release-boundary regression tests require a temporary production server and use only unauthenticated localhost requests:

```sh
pnpm --filter web build
# Start a server only with user authorization; stop it after verification.
pnpm --filter web exec next start --hostname 127.0.0.1 --port 3103
UI_TEST_BASE_URL=http://127.0.0.1:3103 node --test apps/web/test/preview-boundaries.mjs
```

If the host sandbox prevents Turbopack's CSS worker from opening its internal port, `pnpm --filter web exec next build --webpack` verifies the production output without changing the pinned Next.js version or default build script. See `docs/ui-screen-inventory.md`, `docs/ui-design-tokens.md` and `docs/ui-backend-readiness.md` for current UI boundaries.

## Fleet Core

`/app/vehicles`, `/app/vehicles/devices` and `/app/vehicles/:id` are live server-authorized pages in all environments. Vehicle lifecycle is `ACTIVE` / `INACTIVE`; availability and rental states are not inferred. Devices are registry records, not online/offline telemetry. The existing development-only Fleet dashboard/map/rental previews remain separate.

OWNER/ADMIN have `vehicle.read`, `vehicle.manage`, `gps.read`, `gps.manage`; OPERATIONS has the two read permissions. Device assignment/end requires `vehicle.manage`. Vehicle/device writes and audit events share a transaction after taking the same tenant business-row lock used by SaaS Core and rechecking the current membership/profile/business/permission.

License plates are uppercased with whitespace/dot/hyphen removed, then validated as 4–16 ASCII letters/digits. A plate is unique within the business, including inactive vehicles. GPS `provider` is lowercase and `deviceUid` is trimmed but case-sensitive; the pair is globally unique with immutable business ownership and identity. PATCH can change only device label/status. Branches must belong to the verified tenant and be active when newly associated.

A vehicle and device can each have at most one current primary assignment. End the active assignment before disabling either resource or replacing its device. Assignment/end timestamps use the database clock; ended rows remain in history. There are no hard-delete or cross-business transfer APIs. See `docs/fleet-core.md` and the source stage plan under `docs/stages`.

Fleet E2E uses only the existing seeded development project `eeryymswcufnebibigqf`, creates uniquely named disposable records and removes only those records afterward; audit evidence remains. E2E suites run serially because SaaS Core tests exercise revocation of shared demo accounts. Never run these suites against staging/production.
