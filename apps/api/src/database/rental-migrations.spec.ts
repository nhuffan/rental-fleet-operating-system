import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const ids = {
  businessA: '10000000-0000-4000-8000-000000000001',
  businessB: '10000000-0000-4000-8000-000000000002',
  userA: '10000000-0000-4000-8000-000000000011',
  userB: '10000000-0000-4000-8000-000000000012',
  vehicleA: '10000000-0000-4000-8000-000000000031',
  vehicleA2: '10000000-0000-4000-8000-000000000032',
  vehicleB: '10000000-0000-4000-8000-000000000033',
  customerA: '10000000-0000-4000-8000-000000000041',
  customerB: '10000000-0000-4000-8000-000000000042',
};
const tables = ['customers', 'rentals'] as const;
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
    insert into public.vehicles(id, business_id, license_plate, make, model) values
      ('${ids.vehicleA}', '${ids.businessA}', '51A12345', 'Toyota', 'Vios'),
      ('${ids.vehicleA2}', '${ids.businessA}', '51A67890', 'Ford', 'Everest'),
      ('${ids.vehicleB}', '${ids.businessB}', '51A12345', 'Honda', 'City');
    insert into public.customers(id, business_id, name, phone, email) values
      ('${ids.customerA}', '${ids.businessA}', 'Customer A', '+84 912-345-678', 'shared@example.test'),
      ('${ids.customerB}', '${ids.businessB}', 'Customer B', '+84 912-345-678', 'shared@example.test');
  `);
});

type RentalInput = {
  businessId?: string;
  customerId?: string;
  vehicleId?: string;
  startAt?: string;
  endAt?: string;
  status?: 'DRAFT' | 'RESERVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
};
async function insertRental(input: RentalInput = {}) {
  const status = input.status ?? 'DRAFT';
  const reserved = ['RESERVED', 'ACTIVE', 'COMPLETED'].includes(status);
  const handed = ['ACTIVE', 'COMPLETED'].includes(status);
  const complete = status === 'COMPLETED';
  return (
    await db.query<{ id: string }>(
      `
    insert into public.rentals(business_id, customer_id, vehicle_id, start_at, end_at,
      status, reserved_at, handed_over_at, returned_at, cancelled_at, odometer_start, odometer_end)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [
        input.businessId ?? ids.businessA,
        input.customerId ?? ids.customerA,
        input.vehicleId ?? ids.vehicleA,
        input.startAt ?? '2026-10-20T00:00:00Z',
        input.endAt ?? '2026-10-21T00:00:00Z',
        status,
        reserved ? '2026-10-19T00:00:00Z' : null,
        handed ? '2026-10-20T00:00:00Z' : null,
        complete ? '2026-10-20T23:00:00Z' : null,
        status === 'CANCELLED' ? '2026-10-19T01:00:00Z' : null,
        handed ? 100 : null,
        complete ? 200 : null,
      ],
    )
  ).rows[0].id;
}

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

async function expectNoRentalRows() {
  for (const table of tables) {
    expect(
      (await db.query(`select id from public.${table}`)).rows,
    ).toHaveLength(0);
  }
}

describe('customer database invariants', () => {
  it('permits shared contacts and requires at least one canonical valid contact', async () => {
    await db.query(
      `insert into public.customers(business_id, name, phone, email)
      values ($1, 'Shared household', '+84 912-345-678', 'shared@example.test')`,
      [ids.businessA],
    );
    for (const [field, value] of [
      ['name', ' '],
      ['name', ' Untrimmed '],
      ['name', 'x'.repeat(121)],
      ['phone', 'call me'],
      ['phone', '1234'],
      ['phone', ' 123456'],
      ['phone', '1'.repeat(33)],
      ['email', 'invalid'],
      ['email', 'UPPER@example.test'],
      ['email', ' space@example.test'],
      ['notes', 'x'.repeat(2001)],
      ['status', 'DISABLED'],
    ]) {
      await expect(
        db.query(`update public.customers set ${field} = $1 where id = $2`, [
          value,
          ids.customerA,
        ]),
      ).rejects.toMatchObject({ code: '23514' });
    }
    await expect(
      db.query(
        `update public.customers set phone = '', email = '' where id = $1`,
        [ids.customerA],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await db.query(
      `update public.customers set phone = '', email = 'email-only@example.test' where id = $1`,
      [ids.customerA],
    );
    await db.query(
      `update public.customers set phone = '12345', email = '' where id = $1`,
      [ids.customerA],
    );
  });
});

describe('rental database invariants', () => {
  it('enforces tenant foreign keys on insert/update and restricts referenced hard deletion', async () => {
    await expect(
      insertRental({ customerId: ids.customerB }),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      insertRental({ vehicleId: ids.vehicleB }),
    ).rejects.toMatchObject({ code: '23503' });
    const id = await insertRental();
    for (const [field, foreignId] of [
      ['customer_id', ids.customerB],
      ['vehicle_id', ids.vehicleB],
    ]) {
      await expect(
        db.query(`update public.rentals set ${field} = $1 where id = $2`, [
          foreignId,
          id,
        ]),
      ).rejects.toMatchObject({ code: '23503' });
    }
    await expect(
      db.query('delete from public.customers where id = $1', [ids.customerA]),
    ).rejects.toMatchObject({ code: '23001' });
    await expect(
      db.query('delete from public.vehicles where id = $1', [ids.vehicleA]),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('requires a finite positive date window, nonnegative finite money and bounded notes', async () => {
    const id = await insertRental();
    for (const [startAt, endAt] of [
      ['2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
      ['2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z'],
      ['-infinity', '2026-01-01T00:00:00Z'],
      ['2026-01-01T00:00:00Z', 'infinity'],
    ]) {
      await expect(
        db.query(
          'update public.rentals set start_at = $1, end_at = $2 where id = $3',
          [startAt, endAt, id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    }
    for (const [field, value] of [
      ['rental_amount', '-0.01'],
      ['deposit_required_amount', '-1'],
      ['rental_amount', 'NaN'],
      ['deposit_required_amount', 'NaN'],
      ['notes', 'x'.repeat(4001)],
      ['status', 'OVERDUE'],
      ['status', 'RETURNED'],
    ]) {
      await expect(
        db.query(`update public.rentals set ${field} = $1 where id = $2`, [
          value,
          id,
        ]),
      ).rejects.toMatchObject({ code: '23514' });
    }
    await db.query(
      'update public.rentals set rental_amount = 123.45, deposit_required_amount = 100, deposit_received = true where id = $1',
      [id],
    );
    const { rows } = await db.query<{
      rental_amount: string;
      deposit_received: boolean;
    }>(
      'select rental_amount, deposit_received from public.rentals where id = $1',
      [id],
    );
    expect(rows[0]).toEqual({
      rental_amount: '123.45',
      deposit_received: true,
    });
  });

  it('keeps lifecycle milestones and odometers coherent for every canonical state', async () => {
    const draft = await insertRental();
    for (const status of ['RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED']) {
      await expect(
        db.query('update public.rentals set status = $1 where id = $2', [
          status,
          draft,
        ]),
      ).rejects.toMatchObject({ code: '23514' });
    }
    await expect(
      db.query('update public.rentals set odometer_start = 1 where id = $1', [
        draft,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    const active = await insertRental({ status: 'ACTIVE' });
    for (const statement of [
      'set odometer_start = -1',
      'set odometer_end = 200',
      'set handed_over_at = null',
      "set handed_over_at = '2026-10-18T00:00:00Z'",
      "set reserved_at = '-infinity'",
      "set status = 'COMPLETED', returned_at = '2026-10-20T23:00:00Z', odometer_end = 99",
      "set status = 'COMPLETED', returned_at = '2026-10-19T01:00:00Z', odometer_end = 200",
      "set status = 'CANCELLED', cancelled_at = now()",
    ]) {
      await expect(
        db.query(`update public.rentals ${statement} where id = $1`, [active]),
      ).rejects.toMatchObject({ code: '23514' });
    }
    await db.query(
      `update public.rentals set status = 'COMPLETED', returned_at = '2026-10-20T23:00:00Z', odometer_end = 100 where id = $1`,
      [active],
    );
    for (const status of [
      'DRAFT',
      'RESERVED',
      'ACTIVE',
      'COMPLETED',
      'CANCELLED',
    ] as const) {
      // Canonical states can coexist once blocking windows no longer overlap.
      await insertRental({
        status,
        startAt: `2027-0${['DRAFT', 'RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].indexOf(status) + 1}-01T00:00:00Z`,
        endAt: `2027-0${['DRAFT', 'RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].indexOf(status) + 1}-02T00:00:00Z`,
      });
    }
  });

  it('blocks overlapping reservations including draft activation and extension updates', async () => {
    const first = await insertRental({ status: 'RESERVED' });
    await expect(insertRental({ status: 'RESERVED' })).rejects.toMatchObject({
      code: '23P01',
      constraint: 'rentals_blocking_vehicle_time_exclusion',
    });
    const draft = await insertRental();
    await expect(
      db.query(
        `update public.rentals set status = 'RESERVED', reserved_at = now() where id = $1`,
        [draft],
      ),
    ).rejects.toMatchObject({ code: '23P01' });
    await insertRental({
      status: 'RESERVED',
      startAt: '2026-10-21T00:00:00Z',
      endAt: '2026-10-22T00:00:00Z',
    });
    await expect(
      db.query(
        `update public.rentals set end_at = '2026-10-21T00:00:01Z' where id = $1`,
        [first],
      ),
    ).rejects.toMatchObject({ code: '23P01' });
    const row = await db.query<{ end_at: Date }>(
      'select end_at from public.rentals where id = $1',
      [first],
    );
    expect(row.rows[0].end_at.toISOString()).toBe('2026-10-21T00:00:00.000Z');
  });

  it('uses half-open UTC windows and permits adjacent reservations and distinct vehicles/tenants', async () => {
    await insertRental({ status: 'RESERVED' });
    await insertRental({
      status: 'RESERVED',
      startAt: '2026-10-21T07:00:00+07:00',
      endAt: '2026-10-22T07:00:00+07:00',
    });
    await expect(
      insertRental({
        status: 'RESERVED',
        startAt: '2026-10-20T07:00:00+07:00',
        endAt: '2026-10-21T07:00:00+07:00',
      }),
    ).rejects.toMatchObject({ code: '23P01' });
    await insertRental({ status: 'RESERVED', vehicleId: ids.vehicleA2 });
    await insertRental({
      status: 'RESERVED',
      businessId: ids.businessB,
      customerId: ids.customerB,
      vehicleId: ids.vehicleB,
    });
  });

  it('allows drafts/cancelled/completed history to overlap and releases a cancelled reservation', async () => {
    for (const status of ['DRAFT', 'CANCELLED', 'COMPLETED'] as const) {
      await insertRental({ status });
      await insertRental({ status });
    }
    const reserved = await insertRental({ status: 'RESERVED' });
    await db.query(
      `update public.rentals set status = 'CANCELLED', cancelled_at = '2026-10-19T02:00:00Z' where id = $1`,
      [reserved],
    );
    await insertRental({ status: 'RESERVED' });
  });

  it('protects actual possession from a second handover even for nonoverlapping overdue windows', async () => {
    const active = await insertRental({ status: 'ACTIVE' });
    await expect(
      insertRental({
        status: 'ACTIVE',
        startAt: '2026-10-21T00:00:00Z',
        endAt: '2026-10-22T00:00:00Z',
      }),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'rentals_active_vehicle_unique',
    });
    await db.query(
      `update public.rentals set status = 'COMPLETED', returned_at = '2026-10-21T01:00:00Z', odometer_end = 200 where id = $1`,
      [active],
    );
    await insertRental({
      status: 'ACTIVE',
      startAt: '2026-10-21T00:00:00Z',
      endAt: '2026-10-22T00:00:00Z',
    });
    const { rows } = await db.query<{ status: string }>(
      'select status from public.vehicles where id = $1',
      [ids.vehicleA],
    );
    expect(rows[0].status).toBe('ACTIVE');
  });

  it('leaves one database winner for competing overlapping inserts', async () => {
    const outcomes = await Promise.allSettled([
      insertRental({ status: 'RESERVED' }),
      insertRental({ status: 'RESERVED' }),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.find((result) => result.status === 'rejected'),
    ).toMatchObject({ status: 'rejected', reason: { code: '23P01' } });
  });
});

describe('customer/rental RLS and direct Data API permissions', () => {
  beforeEach(async () => {
    await insertRental();
    await insertRental({
      businessId: ids.businessB,
      customerId: ids.customerB,
      vehicleId: ids.vehicleB,
    });
  });

  it('returns only the verified active member tenant', async () => {
    for (const [userId, businessId] of [
      [ids.userA, ids.businessA],
      [ids.userB, ids.businessB],
    ]) {
      await asUser(userId, async () => {
        for (const table of tables) {
          const { rows } = await db.query<{ business_id: string }>(
            `select business_id from public.${table}`,
          );
          expect(rows).toEqual([{ business_id: businessId }]);
        }
      });
    }
  });

  it.each(['profile', 'membership', 'business'])(
    'hides all customer/rental rows after %s revocation',
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
      await asUser(ids.userA, expectNoRentalRows);
    },
  );

  it('hides all customer/rental rows for missing or unaffiliated identities', async () => {
    await asUser('', expectNoRentalRows);
    await asUser('10000000-0000-4000-8000-000000000099', expectNoRentalRows);
  });

  it('denies direct authenticated insert/update/delete and anonymous reads', async () => {
    await asUser(ids.userA, async () => {
      await expect(
        db.exec(
          `insert into public.customers(business_id, name, phone) values ('${ids.businessA}', 'Forbidden', '12345')`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(insertRental()).rejects.toMatchObject({ code: '42501' });
      for (const table of tables) {
        await expect(
          db.exec(`update public.${table} set business_id = business_id`),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec(`delete from public.${table}`),
        ).rejects.toMatchObject({ code: '42501' });
      }
    });
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
