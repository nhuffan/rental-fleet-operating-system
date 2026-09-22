# Stage 1 setup status

The source guide is Stage_1_Setup_Repo_to_Supabase_Project.docx. Scope is repository and environment setup; no business module or schema is created.

- Git branch: main.
- GitHub: https://github.com/nhuffan/rental-fleet-operating-system (private).
- Supabase: rental-fleet-dev, organization nhuffan's Org, ap-southeast-1.
- Project ref: eeryymswcufnebibigqf; provisioning reported ACTIVE_HEALTHY.
- Creation quote confirmed by owner: 0/month. Future plan/usage changes are separate.
- URL and publishable key are configured in both local env files.
- Backend credential is configured only in the ignored API env file.
- DATABASE_URL is configured in the ignored local API env file. Removed the template brackets around the supplied password after successful verification.

## Complete database connection

Open Supabase project Database Settings and set a strong database password; save it in your password manager.
Open Connect, copy a connection URI (use the session pooler if your network needs IPv4), replace the password placeholder with the URL-encoded password, and save it as DATABASE_URL in apps/api/.env.
Do not share passwords in chat or Git. No ORM or migrations are configured in Stage 1.

## Scope boundaries

No Auth flow, business table, GPS/PostGIS setup, staging/production project, or deployment is included at this stage.

## Verification

Node 24.21.0 selected by pnpm for root and API scripts. Build, lint, typecheck, unit test and API e2e test passed. Peer dependencies have no conflicts after removing the unused path alias plugin from the Nest template. Local HTTP smoke checks are run for both apps.
Supabase Auth settings endpoint returned HTTP 200 using the publishable key. PostgreSQL read-only verification subsequently passed over TLS with CA and hostname validation.

## Completion

GitHub CLI is authenticated as nhuffan and main has been pushed to the private repository.
The public Supabase CA is saved at infra/certs/supabase-ca.crt, downloaded from the project Dashboard certificate link. When integrating a database driver, load this CA and enable certificate validation (for node-postgres: ssl: { ca: certificateContents, rejectUnauthorized: true }). Do not disable TLS verification.
