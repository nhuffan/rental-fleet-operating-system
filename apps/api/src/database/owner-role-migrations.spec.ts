import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const migration = '20261023101547_simplify_business_owner_role.sql';
const migrationRoot = '../../supabase/migrations/';
const ids = {
  owner: '00000000-0000-4000-8000-000000000001',
  otherOwner: '00000000-0000-4000-8000-000000000002',
  customer: '00000000-0000-4000-8000-000000000003',
  operator: '00000000-0000-4000-8000-000000000004',
  legacy: '00000000-0000-4000-8000-000000000005',
  business: '00000000-0000-4000-8000-000000000011',
  otherBusiness: '00000000-0000-4000-8000-000000000012',
};

async function database(includeOwnerMigration = true) {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  for (const file of readdirSync(migrationRoot)
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    if (file === migration && !includeOwnerMigration) continue;
    await db.exec(readFileSync(migrationRoot + file, 'utf8'));
  }
  return db;
}

async function fixture(db: PGlite) {
  await db.exec(`
    truncate table public.businesses, public.user_profiles, auth.users cascade;
    insert into auth.users(id) values
      ('${ids.owner}'), ('${ids.otherOwner}'), ('${ids.customer}'),
      ('${ids.operator}'), ('${ids.legacy}');
    insert into public.user_profiles(user_id, display_name)
      select id, 'Profile' from auth.users;
    insert into public.businesses(id, name) values
      ('${ids.business}', 'Business'), ('${ids.otherBusiness}', 'Other business');
    insert into public.business_memberships(business_id, user_id, role_key) values
      ('${ids.business}', '${ids.owner}', 'OWNER'),
      ('${ids.otherBusiness}', '${ids.otherOwner}', 'OWNER');
    insert into public.platform_memberships(user_id) values ('${ids.operator}');
    insert into public.audit_logs(business_id, actor_user_id, action, entity_type, entity_id)
      values ('${ids.business}', '${ids.legacy}', 'historical', 'business', '${ids.business}');
  `);
}

it('blocks legacy memberships without promoting users or deleting domain/audit history', async () => {
  const db = await database(false);
  try {
    await fixture(db);
    await db.exec(`
      insert into public.business_memberships(business_id, user_id, role_key, status) values
        ('${ids.business}', '${ids.legacy}', 'ADMIN', 'DISABLED'),
        ('${ids.otherBusiness}', '${ids.legacy}', 'OPERATIONS', 'ACTIVE');
    `);
    await expect(
      db.exec(readFileSync(migrationRoot + migration, 'utf8')),
    ).rejects.toMatchObject({ code: '23514' });
    expect(
      (
        await db.query<{ role_key: string }>(
          'select role_key from public.business_memberships where user_id = $1 order by role_key',
          [ids.legacy],
        )
      ).rows,
    ).toEqual([{ role_key: 'ADMIN' }, { role_key: 'OPERATIONS' }]);
    expect(
      (await db.query('select * from public.businesses')).rows,
    ).toHaveLength(2);
    expect(
      (await db.query('select * from public.audit_logs')).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select policyname from pg_policies where schemaname = 'public' and tablename = 'audit_logs'",
        )
      ).rows,
    ).toEqual([{ policyname: 'audit_admin' }]);
    // Auth deletion is an explicit administrative decision outside the migration.
    await db.query('delete from auth.users where id = $1', [ids.legacy]);
    await db.exec(readFileSync(migrationRoot + migration, 'utf8'));
    expect(
      (await db.query('select actor_user_id from public.audit_logs')).rows,
    ).toEqual([{ actor_user_id: ids.legacy }]);
    expect(
      (await db.query('select * from public.businesses')).rows,
    ).toHaveLength(2);
  } finally {
    await db.close();
  }
}, 30000);

describe('owner-only database authorization', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await database();
  }, 30000);
  beforeEach(async () => {
    await fixture(db);
  });
  afterAll(async () => {
    await db?.close();
  });

  async function asUser(userId: string, work: () => Promise<void>) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      userId,
    ]);
    await db.exec('set role authenticated');
    try {
      await work();
    } finally {
      await db.exec('reset role');
    }
  }

  it('accepts only OWNER memberships and keeps platform grants independent', async () => {
    for (const role of [
      'ADMIN',
      'OPERATIONS',
      'CUSTOMER',
      'PLATFORM_OPERATOR',
    ]) {
      await expect(
        db.query(
          'insert into public.business_memberships(business_id, user_id, role_key) values ($1, $2, $3)',
          [ids.business, ids.customer, role],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        db.query(
          'update public.business_memberships set role_key = $1 where user_id = $2',
          [role, ids.owner],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    }
    expect(
      (await db.query('select role_key from public.platform_memberships')).rows,
    ).toEqual([{ role_key: 'PLATFORM_OPERATOR' }]);
    expect(
      (
        await db.query(
          "select * from pg_policies where schemaname = 'public' and qual ~ 'ADMIN|OPERATIONS'",
        )
      ).rows,
    ).toEqual([]);
  });

  it('allows only active tenant owners to read their business audit', async () => {
    await asUser(ids.owner, async () => {
      expect(
        (await db.query('select * from public.audit_logs')).rows,
      ).toHaveLength(1);
    });
    for (const userId of [ids.otherOwner, ids.customer, ids.operator]) {
      await asUser(userId, async () => {
        expect(
          (await db.query('select * from public.audit_logs')).rows,
        ).toEqual([]);
        if (userId !== ids.otherOwner) {
          expect(
            (await db.query('select * from public.businesses')).rows,
          ).toEqual([]);
        }
      });
    }
    for (const change of [
      `update public.user_profiles set status = 'DISABLED' where user_id = '${ids.owner}'`,
      `update public.business_memberships set status = 'DISABLED' where user_id = '${ids.owner}'`,
      `update public.businesses set status = 'DISABLED' where id = '${ids.business}'`,
    ]) {
      await db.exec(change);
      await asUser(ids.owner, async () => {
        expect(
          (await db.query('select * from public.audit_logs')).rows,
        ).toEqual([]);
      });
      await fixture(db);
    }
  });

  it('preserves direct-browser write denials and platform deny-all RLS', async () => {
    await asUser(ids.owner, async () => {
      for (const table of [
        'business_memberships',
        'businesses',
        'audit_logs',
        'platform_memberships',
        'platform_audit_logs',
      ]) {
        await expect(
          db.exec(`update public.${table} set id = id`),
        ).rejects.toMatchObject({ code: '42501' });
      }
      for (const table of ['platform_memberships', 'platform_audit_logs']) {
        await expect(
          db.exec(`select * from public.${table}`),
        ).rejects.toMatchObject({ code: '42501' });
      }
    });
    const platformPolicies = await db.query(
      "select * from pg_policies where schemaname = 'public' and tablename in ('platform_memberships', 'platform_audit_logs')",
    );
    expect(platformPolicies.rows).toEqual([]);
  });
});
