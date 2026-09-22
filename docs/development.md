# Development guide

Stage 1 foundation: Next.js Web, NestJS API and managed Supabase in a pnpm monorepo.

## Run locally

```sh
pnpm install
pnpm dev
```

Web: http://localhost:3000. API: http://localhost:3001 (GET / returns Hello World!).
Run independently with `pnpm dev:web` and `pnpm dev:api`.
Node 24.21.0 is downloaded and selected for package scripts by pnpm. pnpm is pinned to 11.19.0.
For direct Node commands use `pnpm exec node`, or activate `.nvmrc` with your Node version manager.

## Environment

Local files: `apps/web/.env.local` and `apps/api/.env`; both are ignored by Git.
For another checkout copy the `.env.example` files and supply credentials from Supabase.

Development project: [rental-fleet-dev](https://supabase.com/dashboard/project/eeryymswcufnebibigqf), Singapore.
Only development is provisioned. Staging and production will use separate Supabase projects and secrets when needed.
`DATABASE_URL` is configured in this local checkout and verified with a read-only PostgreSQL query over TLS. See [setup status](docs/setup-status.md).
The API loads `.env` at startup. The web app loads `.env.local` through Next.js.
Credentials are prepared for Stage 2; application Auth/database integration is not implemented yet.

## Workspace

- `apps/web`: Next.js, TypeScript, App Router, Tailwind, ESLint.
- `apps/api`: NestJS, strict TypeScript, Oxlint, Vitest.
- `packages/contracts`: shared API type boundary.
- `packages/config`: shared configuration boundary.
- `docs`: setup and architecture notes.
- `infra`: managed infrastructure information.

## Checks

```sh
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Security and next stage

Never put backend secrets in `NEXT_PUBLIC_*` variables or commit real environment files.
When adding exposed tables, enable RLS and enforce tenant membership/business_id authorization.
NestJS owns domain logic and critical state changes; RLS is defense in depth.
Next stage: Auth integration, token verification, migrations, Business/Membership schema and tenant isolation tests.

References: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [NestJS](https://docs.nestjs.com/first-steps), [pnpm runtime](https://pnpm.io/package_json#devenginesruntime), [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).
