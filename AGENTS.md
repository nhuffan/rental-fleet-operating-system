# AI rules

- Read README.md, docs/development.md and relevant app instructions before editing. Keep changes within the user's request and preserve unrelated work.
- README introduces the project only. Keep current development/architecture instructions in docs/development.md; do not add setup history or stage completion reports.
- After each implementation batch driven by a stage/plan Markdown file, update the root STAGE_OUTPUT.md in the same commit. Group entries by the exact input stage filename; include the repository plan path, date, implemented behavior, live/preview boundaries, verification results and remaining work. Append a dated entry for later batches rather than overwriting prior history. Never mark an entire stage complete without evidence.
- Use pnpm and preserve its lockfile and pinned Node runtime. Run relevant build, lint, typecheck and security tests; generate OpenAPI/contracts after API changes.
- Ask before starting a server unless the user explicitly authorizes it in the current task. Record owned sessions/PIDs/ports. Stop all servers/watchers you started before finishing, including on failure, and verify they exited. Never stop user-owned processes or use broad kill commands. Leave servers running only when explicitly requested.
- Keep real env files and .env.demo.json out of Git and logs. Never send database credentials or server keys to the browser. TLS certificate/hostname verification is mandatory for database access.
- Supabase supplies identity; NestJS owns authorization. Never authorize using user_metadata. Check active profile, business and membership, then permission. Every tenant resource query must include the verified business ID.
- Keep admin writes and audit events in one transaction; recheck authorization under the tenant lock. Only owners may manage elevated roles; preserve an active owner.
- Keep all schema changes in supabase/migrations using the Supabase CLI. Drizzle is the query layer; do not introduce a competing migration history. Enable RLS on exposed tables; direct Data API writes are denied.
- Development project: eeryymswcufnebibigqf. Never seed/demo-test against staging or production. Do not change other Supabase projects based on account defaults.
