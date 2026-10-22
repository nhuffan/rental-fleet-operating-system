import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
it('replays migrations on clean PostgreSQL and enforces RLS on every core table', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    for (const file of readdirSync('../../supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      await db.exec(readFileSync('../../supabase/migrations/' + file, 'utf8'));
    const result = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'",
    );
    expect(result.rows).toHaveLength(9);
    expect(result.rows.every((r) => r.relrowsecurity)).toBe(true);
    await db.exec(
      `set role authenticated; select * from public.branches; reset role;`,
    );
  } finally {
    await db.close();
  }
}, 30000);
