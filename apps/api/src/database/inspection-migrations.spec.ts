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

beforeEach(async () => {
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
    "insert into public.rentals(id, business_id, customer_id, vehicle_id, start_at, end_at) values ($1, $2, $3, $4, '2026-10-20T00:00:00Z', '2026-10-25T00:00:00Z'), ($5, $6, $7, $8, '2026-10-20T00:00:00Z', '2026-10-25T00:00:00Z')",
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
});

async function inspection(
  overrides: Record<string, string | number | null> = {},
) {
  const values = {
    id: randomUUID(),
    business_id: ids.business,
    rental_id: ids.rental,
    vehicle_id: ids.vehicle,
    type: 'HANDOVER',
    actor_id: ids.owner,
    odometer: 15000,
    fuel_percent: 80,
    exterior_condition: 'GOOD',
    interior_condition: 'GOOD',
    spare_tire: 'PRESENT',
    tools: 'PRESENT',
    registration_document: 'PRESENT',
    insurance_document: 'PRESENT',
    keys: 'PRESENT',
    ...overrides,
  };
  const columns = Object.keys(values);
  await db.query(
    `insert into public.rental_inspections(${columns.join(',')}) values (${columns.map((_, index) => `$${index + 1}`).join(',')})`,
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

it('replays on a clean database, preserves legacy rentals and stores explicit checklist states', async () => {
  expect(
    (await db.query('select id from public.rental_inspections')).rows,
  ).toEqual([]);
  const handover = await inspection({
    odometer: 0,
    fuel_percent: 0,
    tools: 'MISSING',
    spare_tire: 'NOT_APPLICABLE',
    insurance_document: 'NOT_APPLICABLE',
  });
  await inspection({ type: 'RETURN', odometer: 2147483647, fuel_percent: 100 });
  expect(
    (
      await db.query(
        'select odometer, fuel_percent, tools, spare_tire, insurance_document, notes, damage_notes, recorded_at is not null as timestamped from public.rental_inspections where id = $1',
        [handover],
      )
    ).rows,
  ).toEqual([
    {
      odometer: 0,
      fuel_percent: 0,
      tools: 'MISSING',
      spare_tire: 'NOT_APPLICABLE',
      insurance_document: 'NOT_APPLICABLE',
      notes: '',
      damage_notes: '',
      timestamped: true,
    },
  ]);
});

it('requires every snapshot association, measurement and explicit checklist value', async () => {
  for (const field of [
    'business_id',
    'rental_id',
    'vehicle_id',
    'type',
    'actor_id',
    'recorded_at',
    'odometer',
    'fuel_percent',
    'exterior_condition',
    'interior_condition',
    'spare_tire',
    'tools',
    'registration_document',
    'insurance_document',
    'keys',
    'notes',
    'damage_notes',
  ]) {
    await expect(inspection({ [field]: null })).rejects.toMatchObject({
      code: '23502',
    });
  }
});

it('rejects invalid enums, bounds, non-finite times and oversized notes', async () => {
  const invalid: Record<string, string | number>[] = [
    { type: 'OTHER' },
    { odometer: -1 },
    { fuel_percent: -1 },
    { fuel_percent: 101 },
    { exterior_condition: 'UNKNOWN' },
    { interior_condition: 'NOT_APPLICABLE' },
    { spare_tire: '' },
    { tools: 'GOOD' },
    { registration_document: 'UNKNOWN' },
    { insurance_document: 'YES' },
    { keys: 'NO' },
    { recorded_at: 'infinity' },
    { recorded_at: '-infinity' },
    { notes: 'x'.repeat(2001) },
    { damage_notes: 'x'.repeat(2001) },
  ];
  for (const overrides of invalid) {
    await expect(inspection(overrides)).rejects.toMatchObject({
      code: '23514',
    });
  }
  await expect(inspection({ odometer: 2147483648 })).rejects.toMatchObject({
    code: '22003',
  });
  await expect(inspection({ fuel_percent: '2.5' })).rejects.toMatchObject({
    code: '22P02',
  });
});

it('requires nonblank damage notes for either damaged condition', async () => {
  for (const field of ['exterior_condition', 'interior_condition']) {
    for (const damageNotes of ['', '   ', '\n\t  ']) {
      await expect(
        inspection({ [field]: 'DAMAGED', damage_notes: damageNotes }),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'rental_inspections_damage_notes_check',
      });
    }
  }
  await inspection({
    exterior_condition: 'DAMAGED',
    interior_condition: 'DAMAGED',
    damage_notes: 'Vết xước đã đối chiếu khi bàn giao',
    notes: 'x'.repeat(2000),
  });
});

it('rejects cross-tenant and mismatched rental/vehicle associations', async () => {
  const invalid: Record<string, string>[] = [
    { business_id: ids.otherBusiness },
    { rental_id: ids.otherRental },
    { vehicle_id: ids.otherVehicle },
    { vehicle_id: ids.secondVehicle },
    { rental_id: ids.otherRental, vehicle_id: ids.otherVehicle },
  ];
  for (const overrides of invalid) {
    await expect(inspection(overrides)).rejects.toMatchObject({
      code: '23503',
      constraint: 'rental_inspections_rental_tenant_fk',
    });
  }
});

it('allows one snapshot per milestone and rejects duplicate submissions at the database boundary', async () => {
  await inspection();
  await expect(inspection()).rejects.toMatchObject({
    code: '23505',
    constraint: 'rental_inspections_rental_type_unique',
  });
  await inspection({ type: 'RETURN' });
  await expect(inspection({ type: 'RETURN' })).rejects.toMatchObject({
    code: '23505',
    constraint: 'rental_inspections_rental_type_unique',
  });
});

it('rejects trusted-role updates/deletes and protects linked rental/vehicle history', async () => {
  const id = await inspection();
  for (const query of [
    'update public.rental_inspections set odometer = odometer where id = $1',
    "update public.rental_inspections set notes = 'changed' where id = $1",
    'delete from public.rental_inspections where id = $1',
  ]) {
    await expect(db.query(query, [id])).rejects.toMatchObject({
      code: '23001',
      constraint: 'rental_inspections_immutable',
    });
  }
  await expect(
    db.query('delete from public.rentals where id = $1', [ids.rental]),
  ).rejects.toMatchObject({ code: '23001' });
  await expect(
    db.query('update public.rentals set vehicle_id = $1 where id = $2', [
      ids.secondVehicle,
      ids.rental,
    ]),
  ).rejects.toMatchObject({ code: '23503' });
  expect(
    (await db.query('select id from public.rental_inspections')).rows,
  ).toEqual([{ id }]);
});

it('retains historical actor IDs independently of profile and Auth identity removal', async () => {
  const actor = randomUUID();
  await db.query('insert into auth.users(id) values ($1)', [actor]);
  await db.query(
    "insert into public.user_profiles(user_id, display_name) values ($1, 'Historical actor')",
    [actor],
  );
  const id = await inspection({ actor_id: actor });
  await db.query('delete from public.user_profiles where user_id = $1', [
    actor,
  ]);
  await db.query('delete from auth.users where id = $1', [actor]);
  expect(
    (
      await db.query(
        'select actor_id from public.rental_inspections where id = $1',
        [id],
      )
    ).rows,
  ).toEqual([{ actor_id: actor }]);
});

it('allows only active Owners to read their own tenant without customer/platform grant leakage', async () => {
  const own = await inspection();
  const other = await inspection({
    business_id: ids.otherBusiness,
    rental_id: ids.otherRental,
    vehicle_id: ids.otherVehicle,
    actor_id: ids.otherOwner,
  });
  for (const [user, expected] of [
    [ids.owner, own],
    [ids.otherOwner, other],
    [ids.customer, null],
    [ids.operator, null],
  ] as const) {
    await asBrowser('authenticated', user, async () => {
      expect(
        (await db.query('select id from public.rental_inspections')).rows,
      ).toEqual(expected ? [{ id: expected }] : []);
    });
  }
  await asBrowser('anon', '', async () => {
    await expect(
      db.exec('select * from public.rental_inspections'),
    ).rejects.toMatchObject({ code: '42501' });
  });
});

it('revokes tenant reads immediately when Owner membership, profile or business becomes inactive', async () => {
  await inspection();
  for (const [table, key, value] of [
    ['user_profiles', 'user_id', 'owner'],
    ['business_memberships', 'user_id', 'owner'],
    ['businesses', 'id', 'business'],
  ]) {
    await db.query(
      `update public.${table} set status = 'DISABLED' where ${key} = $1`,
      [ids[value]],
    );
    await asBrowser('authenticated', ids.owner, async () => {
      expect(
        (await db.query('select id from public.rental_inspections')).rows,
      ).toEqual([]);
    });
    await db.query(
      `update public.${table} set status = 'ACTIVE' where ${key} = $1`,
      [ids[value]],
    );
  }
});

it('enables RLS, denies all browser writes and hides the trigger function from browser roles', async () => {
  await inspection();
  expect(
    (
      await db.query(
        "select relrowsecurity from pg_class where oid = 'public.rental_inspections'::regclass",
      )
    ).rows,
  ).toEqual([{ relrowsecurity: true }]);
  for (const role of ['anon', 'authenticated'] as const) {
    await asBrowser(
      role,
      role === 'authenticated' ? ids.owner : '',
      async () => {
        await expect(inspection()).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec("update public.rental_inspections set notes = 'changed'"),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec('delete from public.rental_inspections'),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec('truncate public.rental_inspections'),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          db.exec('select public.prevent_rental_inspection_mutation()'),
        ).rejects.toMatchObject({ code: '42501' });
      },
    );
  }
});
