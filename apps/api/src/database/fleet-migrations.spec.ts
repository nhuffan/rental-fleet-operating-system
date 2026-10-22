import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const ids = {
  businessA: '00000000-0000-4000-8000-000000000001',
  businessB: '00000000-0000-4000-8000-000000000002',
  userA: '00000000-0000-4000-8000-000000000011',
  userB: '00000000-0000-4000-8000-000000000012',
  branchA: '00000000-0000-4000-8000-000000000021',
  branchB: '00000000-0000-4000-8000-000000000022',
  vehicleA: '00000000-0000-4000-8000-000000000031',
  vehicleA2: '00000000-0000-4000-8000-000000000032',
  vehicleB: '00000000-0000-4000-8000-000000000033',
  deviceA: '00000000-0000-4000-8000-000000000041',
  deviceA2: '00000000-0000-4000-8000-000000000042',
  deviceB: '00000000-0000-4000-8000-000000000043',
};
const tables = ['vehicles', 'gps_devices', 'device_assignments'] as const;
let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
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
  await db.exec(`
    truncate table public.businesses, public.user_profiles, auth.users cascade;
    insert into auth.users(id) values ('${ids.userA}'), ('${ids.userB}');
    insert into public.user_profiles(user_id, display_name)
      values ('${ids.userA}', 'Owner A'), ('${ids.userB}', 'Owner B');
    insert into public.businesses(id, name)
      values ('${ids.businessA}', 'Business A'), ('${ids.businessB}', 'Business B');
    insert into public.business_memberships(business_id, user_id, role_key)
      values ('${ids.businessA}', '${ids.userA}', 'OWNER'), ('${ids.businessB}', '${ids.userB}', 'OWNER');
    insert into public.branches(id, business_id, name)
      values ('${ids.branchA}', '${ids.businessA}', 'Branch A'), ('${ids.branchB}', '${ids.businessB}', 'Branch B');
    insert into public.vehicles(id, business_id, branch_id, license_plate, make, model) values
      ('${ids.vehicleA}', '${ids.businessA}', '${ids.branchA}', '51A12345', 'Toyota', 'Vios'),
      ('${ids.vehicleA2}', '${ids.businessA}', null, '51A67890', 'Ford', 'Everest'),
      ('${ids.vehicleB}', '${ids.businessB}', '${ids.branchB}', '51A12345', 'Honda', 'City');
    insert into public.gps_devices(id, business_id, provider, device_uid) values
      ('${ids.deviceA}', '${ids.businessA}', 'traccar', 'Tracker-A'),
      ('${ids.deviceA2}', '${ids.businessA}', 'traccar', 'Tracker-A2'),
      ('${ids.deviceB}', '${ids.businessB}', 'traccar', 'Tracker-B');
    insert into public.device_assignments(business_id, vehicle_id, device_id, assigned_at) values
      ('${ids.businessA}', '${ids.vehicleA}', '${ids.deviceA}', '2026-01-01T00:00:00Z'),
      ('${ids.businessB}', '${ids.vehicleB}', '${ids.deviceB}', '2026-01-01T00:00:00Z');
  `);
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

async function expectNoFleetRows() {
  for (const table of tables) {
    expect(
      (await db.query(`select id from public.${table}`)).rows,
    ).toHaveLength(0);
  }
}

describe('fleet database invariants', () => {
  it('keeps canonical plates unique within a business across inactive and active records', async () => {
    await db.query('update public.vehicles set status = $1 where id = $2', [
      'INACTIVE',
      ids.vehicleA,
    ]);
    await expect(
      db.query(
        `insert into public.vehicles(business_id, license_plate, make, model) values ($1, '51A12345', 'Toyota', 'Vios')`,
        [ids.businessA],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    for (const plate of [
      '51a12345',
      '51A-12345',
      '51A 12345',
      'ABC',
      'A'.repeat(17),
    ]) {
      await expect(
        db.query(
          'insert into public.vehicles(business_id, license_plate, make, model) values ($1, $2, $3, $4)',
          [ids.businessA, plate, 'Toyota', 'Vios'],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('protects global provider/UID ownership while preserving case-sensitive device IDs', async () => {
    await db.query('update public.gps_devices set status = $1 where id = $2', [
      'INACTIVE',
      ids.deviceA,
    ]);
    await expect(
      db.query(
        `insert into public.gps_devices(business_id, provider, device_uid) values ($1, 'traccar', 'Tracker-A')`,
        [ids.businessB],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await db.query(
      `insert into public.gps_devices(business_id, provider, device_uid) values ($1, 'traccar', 'tracker-a')`,
      [ids.businessB],
    );
    for (const [provider, uid] of [
      ['Traccar', 'valid'],
      [' traccar', 'valid'],
      ['traccar', 'bad uid'],
      ['traccar', ' uid'],
      ['traccar', 'x'.repeat(129)],
    ]) {
      await expect(
        db.query(
          'insert into public.gps_devices(business_id, provider, device_uid) values ($1, $2, $3)',
          [ids.businessA, provider, uid],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('rejects branches and assignment endpoints from another tenant on insert and update', async () => {
    await expect(
      db.query(
        `insert into public.vehicles(business_id, branch_id, license_plate, make, model) values ($1, $2, '51B12345', 'Ford', 'Ranger')`,
        [ids.businessA, ids.branchB],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      db.query('update public.vehicles set branch_id = $1 where id = $2', [
        ids.branchB,
        ids.vehicleA,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
    await db.exec('delete from public.device_assignments');
    await expect(
      db.query(
        'insert into public.device_assignments(business_id, vehicle_id, device_id) values ($1, $2, $3)',
        [ids.businessA, ids.vehicleB, ids.deviceA],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      db.query(
        'insert into public.device_assignments(business_id, vehicle_id, device_id) values ($1, $2, $3)',
        [ids.businessA, ids.vehicleA, ids.deviceB],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await db.query(
      'insert into public.device_assignments(business_id, vehicle_id, device_id) values ($1, $2, $3)',
      [ids.businessA, ids.vehicleA, ids.deviceA],
    );
    await expect(
      db.query(
        'update public.device_assignments set device_id = $1 where vehicle_id = $2',
        [ids.deviceB, ids.vehicleA],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects temporal reversal and preserves closed history when a tracker is replaced', async () => {
    await expect(
      db.query(
        `update public.device_assignments set unassigned_at = '2025-12-31T00:00:00Z' where vehicle_id = $1`,
        [ids.vehicleA],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await db.query(
      `update public.device_assignments set unassigned_at = '2026-01-02T00:00:00Z' where vehicle_id = $1`,
      [ids.vehicleA],
    );
    await db.query(
      `insert into public.device_assignments(business_id, vehicle_id, device_id, assigned_at) values ($1, $2, $3, '2026-01-02T00:00:00Z')`,
      [ids.businessA, ids.vehicleA, ids.deviceA2],
    );
    const history = await db.query<{
      device_id: string;
      unassigned_at: Date | null;
    }>(
      'select device_id, unassigned_at from public.device_assignments where business_id = $1 and vehicle_id = $2 order by assigned_at',
      [ids.businessA, ids.vehicleA],
    );
    expect(history.rows).toHaveLength(2);
    expect(history.rows[0].device_id).toBe(ids.deviceA);
    expect(history.rows[0].unassigned_at).not.toBeNull();
    expect(history.rows[1].device_id).toBe(ids.deviceA2);
    expect(history.rows[1].unassigned_at).toBeNull();
    await expect(
      db.query('delete from public.gps_devices where id = $1', [ids.deviceA]),
    ).rejects.toMatchObject({ code: '23001' });
    await expect(
      db.query('delete from public.vehicles where id = $1', [ids.vehicleA]),
    ).rejects.toMatchObject({ code: '23001' });
    await expect(
      db.query('delete from public.branches where id = $1', [ids.branchA]),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('allows only one winner for competing current vehicle assignments and prevents sharing a GPS', async () => {
    await db.query(
      `update public.device_assignments set unassigned_at = now() where vehicle_id = $1`,
      [ids.vehicleA],
    );
    const competing = await Promise.allSettled(
      [ids.deviceA, ids.deviceA2].map((device) =>
        db.query(
          'insert into public.device_assignments(business_id, vehicle_id, device_id) values ($1, $2, $3)',
          [ids.businessA, ids.vehicleA, device],
        ),
      ),
    );
    expect(
      competing.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejection = competing.find((result) => result.status === 'rejected');
    expect(rejection).toMatchObject({
      status: 'rejected',
      reason: { code: '23505' },
    });
    const current = await db.query<{ device_id: string }>(
      'select device_id from public.device_assignments where vehicle_id = $1 and unassigned_at is null',
      [ids.vehicleA],
    );
    await expect(
      db.query(
        'insert into public.device_assignments(business_id, vehicle_id, device_id) values ($1, $2, $3)',
        [ids.businessA, ids.vehicleA2, current.rows[0].device_id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('validates lifecycle and descriptive field limits independently of the API', async () => {
    for (const [field, value] of [
      ['make', ' '],
      ['model', 'x'.repeat(81)],
      ['status', 'RENTED'],
    ]) {
      await expect(
        db.query(`update public.vehicles set ${field} = $1 where id = $2`, [
          value,
          ids.vehicleA,
        ]),
      ).rejects.toMatchObject({ code: '23514' });
    }
    await expect(
      db.query('update public.gps_devices set label = $1 where id = $2', [
        'x'.repeat(121),
        ids.deviceA,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query(
        `update public.gps_devices set status = 'ONLINE' where id = $1`,
        [ids.deviceA],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('fleet RLS and direct Data API permissions', () => {
  it('returns only a verified active member’s tenant rows, including historical assignments', async () => {
    await db.query(
      `update public.device_assignments set unassigned_at = now() where vehicle_id = $1`,
      [ids.vehicleA],
    );
    for (const [userId, businessId, vehicleCount] of [
      [ids.userA, ids.businessA, 2],
      [ids.userB, ids.businessB, 1],
    ] as const) {
      await asUser(userId, async () => {
        for (const table of tables) {
          const result = await db.query<{ business_id: string }>(
            `select business_id from public.${table}`,
          );
          expect(result.rows).toHaveLength(
            table === 'device_assignments' ? 1 : vehicleCount,
          );
          expect(
            result.rows.every((row) => row.business_id === businessId),
          ).toBe(true);
        }
      });
    }
  });

  it.each(['profile', 'membership', 'business'])(
    'hides all fleet records when the %s is disabled',
    async (disabled) => {
      if (disabled === 'profile')
        await db.query(
          `update public.user_profiles set status = 'DISABLED' where user_id = $1`,
          [ids.userA],
        );
      if (disabled === 'membership')
        await db.query(
          `update public.business_memberships set status = 'DISABLED' where user_id = $1`,
          [ids.userA],
        );
      if (disabled === 'business')
        await db.query(
          `update public.businesses set status = 'DISABLED' where id = $1`,
          [ids.businessA],
        );
      await asUser(ids.userA, expectNoFleetRows);
    },
  );

  it('returns no rows for an unaffiliated identity or a missing claim', async () => {
    await asUser('00000000-0000-4000-8000-000000000099', expectNoFleetRows);
    await asUser('', expectNoFleetRows);
  });

  it('denies insert, update and delete for authenticated users on every fleet table', async () => {
    await asUser(ids.userA, async () => {
      const inserts = [
        `insert into public.vehicles(business_id, license_plate, make, model) values ('${ids.businessA}', '51Z99999', 'Toyota', 'Vios')`,
        `insert into public.gps_devices(business_id, provider, device_uid) values ('${ids.businessA}', 'traccar', 'Forbidden')`,
        `insert into public.device_assignments(business_id, vehicle_id, device_id) values ('${ids.businessA}', '${ids.vehicleA2}', '${ids.deviceA2}')`,
      ];
      for (const statement of inserts)
        await expect(db.exec(statement)).rejects.toMatchObject({
          code: '42501',
        });
      for (const table of tables) {
        await expect(
          db.exec(`update public.${table} set business_id = business_id`),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec(`delete from public.${table}`),
        ).rejects.toMatchObject({ code: '42501' });
      }
    });
  });

  it('denies anonymous fleet reads', async () => {
    await db.exec('set role anon');
    try {
      for (const table of tables)
        await expect(
          db.exec(`select * from public.${table}`),
        ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await db.exec('reset role');
    }
  });
});
