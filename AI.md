# AI Guide for Rental Fleet Operating System

## Read first

1. README.md for project purpose.
2. docs/setup-status.md for completed Stage 1 scope.
3. docs/development.md for commands and environment handling.
4. The relevant app instructions and files before editing.

## Development server rules

- Ask the user for permission before starting a development server, preview server, watcher, or equivalent long-running process, unless the current task explicitly authorizes starting it.
- Permission applies only to the current task; never assume it carries over to later tasks.
- Record the session IDs, process IDs, and ports for processes you start.
- Stop all servers and related child processes you started as soon as the required check is complete, and always before the final response, including when the task fails or is blocked.
- Verify that those processes have exited and their ports are no longer listening. If a port belongs to a user-started process, leave it running and report that distinction.
- Never leave AI-started development servers running in the background after handing the task back, unless the user explicitly asks to keep them running.
- Never stop a user-started server or an unrelated process. Do not use broad commands such as killall node or pkill node; target only the verified session/process tree you own.

## Repository and documentation

- Keep README.md focused on project introduction: purpose, scope, current product stage, and high-level architecture. Keep setup commands, operational checklists, credentials guidance, and AI rules in docs/ or AI.md.
- Keep app README files focused on their role in the project.
- Use pnpm only. Preserve the pinned package manager, Node runtime, and pnpm-lock.yaml.
- Use rg before edits and preserve unrelated user changes.
- Run checks appropriate to the changes. Existing commands include pnpm build, pnpm lint, pnpm typecheck, pnpm test, and pnpm test:e2e. Do not start a persistent server for documentation-only edits.

## Architecture and scope

- apps/web: Next.js, TypeScript, App Router, Tailwind CSS.
- apps/api: NestJS, strict TypeScript, domain logic and API contracts.
- packages/contracts: shared types and API contracts.
- packages/config: shared configuration boundary.
- Stage 1 is foundation only. Auth integration, Business/Membership schema, migrations, Vehicle/Rental/GPS modules, and staging/production provisioning belong to later requested stages.

## Environment and Supabase

- Real env files are apps/web/.env.local and apps/api/.env; never commit them or print their secret values.
- Commit only .env.example placeholders. Never put database passwords, DATABASE_URL, or backend secret/service-role keys into NEXT_PUBLIC_* variables.
- Use the development Supabase project specified in infra/README.md. Do not modify another project based on account defaults.
- Preserve TLS certificate and hostname validation for direct database connections. The public CA is in infra/certs/supabase-ca.crt.
- Future tables in exposed schemas require RLS and tenant membership/business_id checks. Authentication alone is not authorization; user-editable metadata must not grant privileges.
- NestJS owns domain logic and critical state transitions. RLS complements backend authorization.
