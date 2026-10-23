import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

let db: PGlite;
let ids: Record<string, string>;

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
afterAll(async () => db?.close());

async function fixture() {
  ids = Object.fromEntries(
    [
      'owner',
      'otherOwner',
      'customer',
      'operator',
      'business',
      'otherBusiness',
      'vehicle',
      'secondVehicle',
      'otherVehicle',
      'rental',
      'otherRental',
      'tenantCustomer',
      'otherCustomer',
    ].map((name) => [name, randomUUID()]),
  );
  await db.exec(
    'truncate public.businesses, public.user_profiles, auth.users cascade',
  );
  await db.query('insert into auth.users(id) values ($1), ($2), ($3), ($4)', [
    ids.owner,
    ids.otherOwner,
    ids.customer,
    ids.operator,
  ]);
  await db.exec(
    "insert into public.user_profiles(user_id, display_name) select id, 'Profile' from auth.users",
  );
  await db.query(
    "insert into public.businesses(id, name) values ($1, 'Tenant'), ($2, 'Other tenant')",
    [ids.business, ids.otherBusiness],
  );
  await db.query(
    "insert into public.business_memberships(business_id, user_id, role_key) values ($1, $2, 'OWNER'), ($3, $4, 'OWNER')",
    [ids.business, ids.owner, ids.otherBusiness, ids.otherOwner],
  );
  await db.query(
    'insert into public.platform_memberships(user_id) values ($1)',
    [ids.operator],
  );
  await db.query(
    "insert into public.vehicles(id, business_id, license_plate, make, model) values ($1, $2, '51A11111', 'Make', 'Model'), ($3, $2, '51A22222', 'Make', 'Model'), ($4, $5, '51A33333', 'Make', 'Model')",
    [
      ids.vehicle,
      ids.business,
      ids.secondVehicle,
      ids.otherVehicle,
      ids.otherBusiness,
    ],
  );
  await db.query(
    "insert into public.customers(id, business_id, name, phone) values ($1, $2, 'Customer', '0900000000'), ($3, $4, 'Other customer', '0900000001')",
    [ids.tenantCustomer, ids.business, ids.otherCustomer, ids.otherBusiness],
  );
  await db.query(
    "insert into public.rentals(id, business_id, customer_id, vehicle_id, start_at, end_at, rental_amount, deposit_required_amount) values ($1, $2, $3, $4, '2026-10-20T00:00:00Z', '2026-10-25T00:00:00Z', 1500000, 500000), ($5, $6, $7, $8, '2026-10-20T00:00:00Z', '2026-10-25T00:00:00Z', 1500000, 500000)",
    [
      ids.rental,
      ids.business,
      ids.tenantCustomer,
      ids.vehicle,
      ids.otherRental,
      ids.otherBusiness,
      ids.otherCustomer,
      ids.otherVehicle,
    ],
  );
}
beforeEach(fixture);

async function movement(overrides: Record<string, string | null> = {}) {
  const values = {
    id: randomUUID(),
    business_id: ids.business,
    vehicle_id: ids.vehicle,
    rental_id: ids.rental,
    kind: 'RENTAL_PAYMENT',
    category: 'RENTAL',
    amount: '100000',
    occurred_at: '2026-10-23T00:00:00Z',
    created_by: ids.owner,
    ...overrides,
  };
  const columns = Object.keys(values);
  await db.query(
    `insert into public.commercial_movements(${columns.join(',')}) values (${columns.map((_, index) => `$${index + 1}`).join(',')})`,
    Object.values(values),
  );
  return values.id;
}

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

it('stores large whole-VND values exactly and leaves rental contract/deposit fields untouched', async () => {
  await movement({ amount: '999999999999999' });
  await movement({ amount: '1' });
  expect(
    (
      await db.query(
        'select sum(amount)::text as total from public.commercial_movements',
      )
    ).rows,
  ).toEqual([{ total: '1000000000000000' }]);
  expect(
    (
      await db.query(
        'select rental_amount::text, deposit_required_amount::text, deposit_received from public.rentals where id = $1',
        [ids.rental],
      )
    ).rows,
  ).toEqual([
    {
      rental_amount: '1500000.00',
      deposit_required_amount: '500000.00',
      deposit_received: false,
    },
  ]);
});

it('enforces money, dates, kind/category, bounded text and required rental associations', async () => {
  const invalid: Record<string, string | null>[] = [
    { amount: '0' },
    { amount: '-1' },
    { amount: '1000000000000000' },
    { amount: 'NaN' },
    { occurred_at: 'infinity' },
    { created_at: '-infinity' },
    { kind: 'OTHER' },
    { category: 'DEPOSIT' },
    { kind: 'EXPENSE', category: 'RENTAL' },
    { reference: 'x'.repeat(161) },
    { notes: 'x'.repeat(2001) },
    { rental_id: null },
    { vehicle_id: null },
    {
      kind: 'DEPOSIT_RECEIPT',
      category: 'DEPOSIT',
      rental_id: null,
      vehicle_id: null,
    },
  ];
  for (const overrides of invalid) {
    await expect(movement(overrides)).rejects.toMatchObject({ code: '23514' });
  }
  await movement({
    rental_id: null,
    vehicle_id: null,
    kind: 'MISC_INCOME',
    category: 'OTHER_INCOME',
  });
  await movement({
    rental_id: null,
    vehicle_id: null,
    kind: 'EXPENSE',
    category: 'TOLL',
  });
});

it('rejects foreign-tenant vehicles/rentals and a same-tenant vehicle that does not belong to the rental', async () => {
  const invalid: Record<string, string | null>[] = [
    {
      vehicle_id: ids.otherVehicle,
      rental_id: null,
      kind: 'EXPENSE',
      category: 'FUEL',
    },
    { rental_id: ids.otherRental, vehicle_id: ids.vehicle },
    { rental_id: ids.rental, vehicle_id: ids.secondVehicle },
  ];
  for (const overrides of invalid) {
    await expect(movement(overrides)).rejects.toMatchObject({ code: '23503' });
  }
});

it('preserves both original and equal positive-amount reversal with only one reversal per original', async () => {
  const original = await movement();
  const reversal = await movement({
    reversal_of: original,
    occurred_at: '2026-10-24T00:00:00Z',
  });
  expect(
    (
      await db.query(
        'select id, amount::text, reversal_of from public.commercial_movements order by occurred_at',
      )
    ).rows,
  ).toEqual([
    { id: original, amount: '100000', reversal_of: null },
    { id: reversal, amount: '100000', reversal_of: original },
  ]);
  await expect(movement({ reversal_of: original })).rejects.toMatchObject({
    code: '23505',
  });
  await expect(
    db.query('delete from public.commercial_movements where id = $1', [
      original,
    ]),
  ).rejects.toMatchObject({ code: '23001' });
});

it('rejects forged reversal amounts, types, associations, backdating and reversal chains', async () => {
  const original = await movement();
  const invalid: Record<string, string | null>[] = [
    { amount: '1' },
    { kind: 'DEPOSIT_RECEIPT', category: 'DEPOSIT' },
    { vehicle_id: ids.secondVehicle },
    { rental_id: null },
    { occurred_at: '2026-10-22T23:59:59Z' },
  ];
  for (const overrides of invalid) {
    await expect(
      movement({ reversal_of: original, ...overrides }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'commercial_movements_reversal_mirror_check',
    });
  }
  const reversal = await movement({ reversal_of: original });
  await expect(movement({ reversal_of: reversal })).rejects.toMatchObject({
    code: '23514',
  });
  await expect(
    movement({
      business_id: ids.otherBusiness,
      rental_id: ids.otherRental,
      vehicle_id: ids.otherVehicle,
      reversal_of: original,
    }),
  ).rejects.toMatchObject({ code: '23503' });
  const self = randomUUID();
  await expect(movement({ id: self, reversal_of: self })).rejects.toMatchObject(
    { code: '23503' },
  );
});

it('keeps movements after rental cancellation and prevents deleting or reassigning linked rental history', async () => {
  await movement();
  await db.query(
    "update public.rentals set status = 'CANCELLED', cancelled_at = '2026-10-24T00:00:00Z' where id = $1",
    [ids.rental],
  );
  expect(
    (await db.query('select * from public.commercial_movements')).rows,
  ).toHaveLength(1);
  await expect(
    db.query('delete from public.rentals where id = $1', [ids.rental]),
  ).rejects.toMatchObject({ code: '23001' });
  await expect(
    db.query('update public.rentals set vehicle_id = $1 where id = $2', [
      ids.secondVehicle,
      ids.rental,
    ]),
  ).rejects.toMatchObject({ code: '23503' });
  await movement({ created_by: randomUUID() });
});

it('lets only active owners read their own tenant; platform/customer/other tenant grants do not leak rows', async () => {
  const own = await movement();
  const other = await movement({
    business_id: ids.otherBusiness,
    rental_id: ids.otherRental,
    vehicle_id: ids.otherVehicle,
  });
  for (const [user, expected] of [
    [ids.owner, own],
    [ids.otherOwner, other],
    [ids.customer, null],
    [ids.operator, null],
  ] as const) {
    await asBrowser('authenticated', user, async () => {
      expect(
        (await db.query('select id from public.commercial_movements')).rows,
      ).toEqual(expected ? [{ id: expected }] : []);
    });
  }
  await asBrowser('anon', '', async () => {
    await expect(
      db.exec('select * from public.commercial_movements'),
    ).rejects.toMatchObject({ code: '42501' });
  });
});

it('revokes owner reads immediately when profile, membership or business is disabled', async () => {
  for (const [table, key, value] of [
    ['user_profiles', 'user_id', 'owner'],
    ['business_memberships', 'user_id', 'owner'],
    ['businesses', 'id', 'business'],
  ]) {
    await movement();
    await db.query(
      `update public.${table} set status = 'DISABLED' where ${key} = $1`,
      [ids[value]],
    );
    await asBrowser('authenticated', ids.owner, async () => {
      expect(
        (await db.query('select * from public.commercial_movements')).rows,
      ).toEqual([]);
    });
    await fixture();
  }
});

it('enables RLS and denies all browser financial writes and trigger-function execution', async () => {
  await movement();
  expect(
    (
      await db.query(
        "select relrowsecurity from pg_class where oid = 'public.commercial_movements'::regclass",
      )
    ).rows,
  ).toEqual([{ relrowsecurity: true }]);
  for (const role of ['anon', 'authenticated'] as const) {
    await asBrowser(
      role,
      role === 'authenticated' ? ids.owner : '',
      async () => {
        await expect(movement()).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec('update public.commercial_movements set amount = 1'),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec('delete from public.commercial_movements'),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec('select public.validate_commercial_reversal()'),
        ).rejects.toMatchObject({ code: '42501' });
      },
    );
  }
});
