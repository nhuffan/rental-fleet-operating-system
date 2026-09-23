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
- OWNER manages all roles; ADMIN manages operations memberships and business/branch/settings data; OPERATIONS reads business/branches/settings. The last active owner cannot be disabled or demoted through the API. Guards and transaction rechecks enforce this independently of the UI.
- Every tenant query is scoped. Writes and audit events share a transaction; a business row lock serializes tenant admin changes. Audit metadata contains changed field names and request IDs, not passwords/tokens.
- RLS permits only membership-scoped Data API reads; direct writes by anon/authenticated are revoked. No SECURITY DEFINER helper is used. The API uses a trusted DB connection and must always enforce its own authorization.
- Shared API contracts are under packages/contracts. Database schema and API env are server-only. No vehicle/rental/GPS domain is implemented yet.

## Staging

Use an independent Supabase project and run the same migrations with its env. Supply .env.staging.api and .env.staging.web at the root (both ignored); use the app env examples as a starting point. Set APP_ENV=staging, WEB_ORIGIN to the HTTPS Web origin, public API/Supabase URLs and the staging database credentials. Do not run demo seed.

```sh
docker compose --env-file .env.staging.web -f compose.staging.yaml up --build -d
docker compose --env-file .env.staging.web -f compose.staging.yaml down
```

The Dockerfile has separate api/web targets. NEXT_PUBLIC_* values are public build arguments; secrets are runtime env only and excluded from the build context. Put an HTTPS reverse proxy in front of the loopback-bound ports. Configure Supabase Auth Site URL/redirect allowlist for that Web origin. No staging cloud project is created automatically.

Supabase leaked-password protection requires Pro or above; it is unavailable on the current Free project ([documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).
