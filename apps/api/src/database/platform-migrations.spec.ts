import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

let db: PGlite;
let operator: string;
let owner: string;
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  for (const file of readdirSync('../../supabase/migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(`../../supabase/migrations/${file}`, 'utf8'));
  }
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  operator = randomUUID();
  owner = randomUUID();
  await db.exec(
    'truncate table public.businesses, public.user_profiles, public.platform_audit_logs, auth.users cascade',
  );
  await db.query('insert into auth.users(id) values ($1), ($2)', [
    operator,
    owner,
  ]);
  await db.query(
    "insert into public.user_profiles(user_id, display_name) values ($1, 'Operator'), ($2, 'Tenant owner')",
    [operator, owner],
  );
  const business = randomUUID();
  await db.query(
    "insert into public.businesses(id, name) values ($1, 'Tenant')",
    [business],
  );
  await db.query(
    "insert into public.business_memberships(business_id, user_id, role_key) values ($1, $2, 'OWNER')",
    [business, owner],
  );
  await db.query(
    'insert into public.platform_memberships(user_id) values ($1)',
    [operator],
  );
});

async function asBrowser(
  role: 'authenticated' | 'anon',
  userId: string,
  run: () => Promise<void>,
) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId,
  ]);
  await db.exec(`set role ${role}`);
  try {
    await run();
  } finally {
    await db.exec('reset role');
  }
}

it('requires a dedicated unique platform membership and rejects tenant roles or unknown identities', async () => {
  const members = await db.query<{ user_id: string; role_key: string }>(
    'select user_id, role_key from public.platform_memberships',
  );
  expect(members.rows).toEqual([
    { user_id: operator, role_key: 'PLATFORM_OPERATOR' },
  ]);
  await expect(
    db.query('insert into public.platform_memberships(user_id) values ($1)', [
      operator,
    ]),
  ).rejects.toMatchObject({ code: '23505' });
  await expect(
    db.query(
      "insert into public.platform_memberships(user_id, role_key) values ($1, 'OWNER')",
      [owner],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  await expect(
    db.query(
      "update public.platform_memberships set status = 'PENDING' where user_id = $1",
      [operator],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  await expect(
    db.query('insert into public.platform_memberships(user_id) values ($1)', [
      randomUUID(),
    ]),
  ).rejects.toMatchObject({ code: '23503' });
});

it('denies all direct browser reads and writes even to a registered platform operator', async () => {
  await db.query(
    "insert into public.platform_audit_logs(actor_user_id, action, entity_type) values ($1, 'platform.overview.read', 'platform')",
    [operator],
  );
  for (const [role, user] of [
    ['authenticated', operator],
    ['authenticated', owner],
    ['anon', ''],
  ] as const) {
    await asBrowser(role, user, async () => {
      for (const table of ['platform_memberships', 'platform_audit_logs']) {
        await expect(
          db.exec(`select * from public.${table}`),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec(`update public.${table} set id = id`),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec(`delete from public.${table}`),
        ).rejects.toMatchObject({ code: '42501' });
      }
      await expect(
        db.query(
          'insert into public.platform_memberships(user_id) values ($1)',
          [owner],
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        db.query(
          "insert into public.platform_audit_logs(actor_user_id, action, entity_type) values ($1, 'forged', 'platform')",
          [operator],
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
  }
});

it('keeps RLS deny-all even if SELECT is accidentally granted later', async () => {
  const catalog = await db.query<{ relname: string; relrowsecurity: boolean }>(
    "select relname, relrowsecurity from pg_class where oid in ('public.platform_memberships'::regclass, 'public.platform_audit_logs'::regclass)",
  );
  expect(catalog.rows).toHaveLength(2);
  expect(catalog.rows.every((row) => row.relrowsecurity)).toBe(true);
  expect(
    (
      await db.query(
        "select * from pg_policies where schemaname = 'public' and tablename in ('platform_memberships', 'platform_audit_logs')",
      )
    ).rows,
  ).toEqual([]);
  await db.exec(
    'begin; grant select on public.platform_memberships, public.platform_audit_logs to authenticated',
  );
  try {
    await asBrowser('authenticated', operator, async () => {
      expect(
        (await db.query('select * from public.platform_memberships')).rows,
      ).toEqual([]);
      expect(
        (await db.query('select * from public.platform_audit_logs')).rows,
      ).toEqual([]);
    });
  } finally {
    await db.exec('rollback');
  }
});

it('retains separate platform audit history after profile deletion and bounds metadata', async () => {
  await db.query(
    "insert into public.platform_audit_logs(actor_user_id, action, entity_type, metadata) values ($1, 'platform.overview.read', 'platform', $2::jsonb)",
    [operator, JSON.stringify({ requestId: randomUUID() })],
  );
  await expect(
    db.query(
      "insert into public.platform_audit_logs(actor_user_id, action, entity_type, metadata) values ($1, 'platform.overview.read', 'platform', '[]')",
      [operator],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  await expect(
    db.query(
      "insert into public.platform_audit_logs(actor_user_id, action, entity_type, metadata) values ($1, 'platform.overview.read', 'platform', $2::jsonb)",
      [operator, JSON.stringify({ oversized: 'x'.repeat(4096) })],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  await db.query('delete from public.user_profiles where user_id = $1', [
    operator,
  ]);
  expect(
    (
      await db.query(
        'select * from public.platform_memberships where user_id = $1',
        [operator],
      )
    ).rows,
  ).toEqual([]);
  expect(
    (await db.query('select actor_user_id from public.platform_audit_logs'))
      .rows,
  ).toEqual([{ actor_user_id: operator }]);
  expect((await db.query('select * from public.audit_logs')).rows).toEqual([]);
});
