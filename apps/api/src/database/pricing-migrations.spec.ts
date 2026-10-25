import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { calculateQuote, type RateInput } from '../pricing/engine.js';
let db: PGlite;
let ids: Record<string, string>;
type Values = Record<string, string | number | null>;
const start = '2026-10-25T03:00:00.000Z',
  end = '2026-10-26T03:00:00.000Z';
async function insert(table: string, row: Values) {
  const keys = Object.keys(row);
  await db.query(
    `insert into public.${table}(${keys.join(',')}) values(${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
    Object.values(row),
  );
}
async function card(overrides: Values = {}) {
  const id = randomUUID();
  await insert('rental_rate_cards', {
    id,
    business_id: ids.a,
    vehicle_id: ids.vehicle,
    name: 'Rate',
    hourly_rate: '100000',
    daily_rate: '900000',
    minimum_charge: '0',
    extra_hour_rate: null,
    effective_from: '2026-01-01T00:00:00Z',
    effective_until: null,
    created_by: ids.owner,
    ...overrides,
  });
  return id;
}
function breakdown(id: string) {
  return calculateQuote(
    {
      id,
      version: 1,
      name: 'Rate',
      scope: 'VEHICLE',
      hourlyRate: '100000',
      dailyRate: '900000',
      minimumCharge: '0',
      extraHourRate: null,
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveUntil: null,
    } satisfies RateInput,
    { vehicleId: ids.vehicle, startAt: start, endAt: end },
  );
}
async function snapshot(rateId: string | null, overrides: Values = {}) {
  const id = randomUUID();
  await insert('rental_quote_snapshots', {
    id,
    business_id: ids.a,
    rental_id: ids.rental,
    vehicle_id: ids.vehicle,
    rate_card_id: rateId,
    mode: rateId ? 'CALCULATED' : 'MANUAL',
    breakdown: rateId ? JSON.stringify(breakdown(rateId)) : null,
    agreed_amount: '900000',
    override_reason: rateId ? null : 'Agreed manual price',
    created_by: ids.owner,
    ...overrides,
  });
  return id;
}
async function actor(user: string, work: () => Promise<unknown>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role authenticated');
  try {
    return await work();
  } finally {
    await db.exec('reset role');
  }
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const file of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('../../supabase/migrations/' + file, 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec(
    'truncate public.businesses,public.user_profiles,auth.users cascade',
  );
  ids = Object.fromEntries(
    [
      'a',
      'b',
      'owner',
      'foreign',
      'customer',
      'platform',
      'vehicle',
      'otherVehicle',
      'otherOwnVehicle',
      'rental',
      'otherRental',
      'tenantCustomer',
      'otherCustomer',
    ].map((k) => [k, randomUUID()]),
  );
  for (const k of ['owner', 'foreign', 'customer', 'platform']) {
    await db.query('insert into auth.users(id) values($1)', [ids[k]]);
    await insert('user_profiles', {
      user_id: ids[k],
      display_name: 'Pricing fixture',
    });
  }
  await insert('platform_memberships', { user_id: ids.platform });
  for (const other of [false, true]) {
    const b = ids[other ? 'b' : 'a'];
    await insert('businesses', { id: b, name: 'Pricing tenant' });
    await insert('business_memberships', {
      business_id: b,
      user_id: ids[other ? 'foreign' : 'owner'],
      role_key: 'OWNER',
    });
    await insert('vehicles', {
      id: ids[other ? 'otherVehicle' : 'vehicle'],
      business_id: b,
      license_plate: other ? 'OTHER123' : 'OWN123',
      make: 'QA',
      model: 'Pricing',
    });
    await insert('customers', {
      id: ids[other ? 'otherCustomer' : 'tenantCustomer'],
      business_id: b,
      name: 'QA Customer',
      phone: '0901234567',
    });
    await insert('rentals', {
      id: ids[other ? 'otherRental' : 'rental'],
      business_id: b,
      vehicle_id: ids[other ? 'otherVehicle' : 'vehicle'],
      customer_id: ids[other ? 'otherCustomer' : 'tenantCustomer'],
      start_at: start,
      end_at: end,
      status: 'RESERVED',
      reserved_at: '2026-10-20T00:00:00Z',
      rental_amount: '900000',
    });
  }
  await insert('vehicles', {
    id: ids.otherOwnVehicle,
    business_id: ids.a,
    license_plate: 'OWN456',
    make: 'QA',
    model: 'Other',
  });
});
afterAll(async () => {
  await db?.close();
});
it('excludes overlapping ACTIVE ranges separately for business defaults and each vehicle', async () => {
  await card({ vehicle_id: null, effective_until: '2026-06-01T00:00:00Z' });
  await expect(
    card({ vehicle_id: null, effective_from: '2026-05-01T00:00:00Z' }),
  ).rejects.toMatchObject({
    code: '23P01',
    constraint: 'rental_rate_cards_default_overlap',
  });
  await card({ vehicle_id: null, effective_from: '2026-06-01T00:00:00Z' });
  await card();
  await expect(card()).rejects.toMatchObject({
    code: '23P01',
    constraint: 'rental_rate_cards_vehicle_overlap',
  });
  await card({ vehicle_id: ids.otherOwnVehicle });
  await card({ business_id: ids.b, vehicle_id: ids.otherVehicle });
  const inactive = await card({ status: 'INACTIVE' });
  await expect(
    db.query("update rental_rate_cards set status='ACTIVE' where id=$1", [
      inactive,
    ]),
  ).rejects.toMatchObject({ code: '23P01' });
});
it('rejects cross-tenant vehicles, fractional or nonfinite prices and malformed ranges', async () => {
  await expect(card({ vehicle_id: ids.otherVehicle })).rejects.toMatchObject({
    code: '23503',
  });
  for (const changes of [
    { hourly_rate: '1.5' },
    { daily_rate: 'NaN' },
    { minimum_charge: '-1' },
    { extra_hour_rate: '0' },
    { hourly_rate: null, daily_rate: null },
    { daily_rate: null, extra_hour_rate: '1' },
    { effective_from: 'infinity' },
    { effective_until: '2025-01-01T00:00:00Z' },
  ])
    await expect(card(changes)).rejects.toMatchObject({ code: '23514' });
});
it('preserves a copied quote when its source rate changes and prevents mutable history', async () => {
  const id = await card();
  const saved = await snapshot(id);
  await db.query(
    'update rental_rate_cards set daily_rate=1000000,version=2 where id=$1',
    [id],
  );
  expect(
    (
      await db.query<{ breakdown: ReturnType<typeof breakdown> }>(
        'select breakdown from rental_quote_snapshots where id=$1',
        [saved],
      )
    ).rows[0].breakdown.calculatedAmount,
  ).toBe('900000');
  for (const statement of [
    'update rental_quote_snapshots set agreed_amount=900000 where id=$1',
    'delete from rental_quote_snapshots where id=$1',
  ])
    await expect(db.query(statement, [saved])).rejects.toMatchObject({
      code: '23001',
      constraint: 'rental_quote_snapshots_immutable',
    });
  await expect(
    db.query('delete from rental_rate_cards where id=$1', [id]),
  ).rejects.toMatchObject({
    code: '23001',
    constraint: 'rental_quote_snapshots_rate_tenant_fk',
  });
  await expect(
    db.query('update rentals set rental_amount=1 where id=$1', [ids.rental]),
  ).rejects.toMatchObject({
    code: '23001',
    constraint: 'rentals_quoted_amount_immutable',
  });
  await db.query(
    "update rentals set notes='Still editable',end_at='2026-10-27T03:00:00Z' where id=$1",
    [ids.rental],
  );
  expect(
    (
      await db.query<{ breakdown: ReturnType<typeof breakdown> }>(
        'select breakdown from rental_quote_snapshots where id=$1',
        [saved],
      )
    ).rows[0].breakdown.endAt,
  ).toBe(end);
});
it('requires confirmed matching rentals, exact lines and an explicit reason for manual/override pricing', async () => {
  const id = await card();
  await expect(snapshot(id, { agreed_amount: '1' })).rejects.toMatchObject({
    code: '23514',
    constraint: 'rental_quote_snapshots_rental_matches',
  });
  await expect(
    snapshot(id, { vehicle_id: ids.otherVehicle }),
  ).rejects.toMatchObject({ code: '23514' });
  const bad = breakdown(id);
  bad.lines[0].amount = '1';
  await expect(
    snapshot(id, { breakdown: JSON.stringify(bad) }),
  ).rejects.toMatchObject({
    code: '23514',
    constraint: 'rental_quote_snapshots_lines_match',
  });
  for (const reason of [null, '', '   '])
    await expect(
      snapshot(null, { override_reason: reason }),
    ).rejects.toMatchObject({ code: '23514' });
  await snapshot(null);
  await expect(snapshot(null)).rejects.toMatchObject({ code: '23505' });
});
it('reads only active Owner tenant rows and denies all direct browser writes', async () => {
  const own = await card();
  await snapshot(own);
  await card({ business_id: ids.b, vehicle_id: ids.otherVehicle });
  for (const [user, count] of [
    [ids.owner, 1],
    [ids.foreign, 1],
    [ids.customer, 0],
    [ids.platform, 0],
  ] as const)
    await actor(user, async () => {
      expect(
        (await db.query('select id from rental_rate_cards')).rows,
      ).toHaveLength(count);
      expect(
        (await db.query('select id from rental_quote_snapshots')).rows,
      ).toHaveLength(user === ids.owner ? 1 : 0);
    });
  for (const change of [
    'businesses',
    'user_profiles',
    'business_memberships',
  ]) {
    const key = change === 'businesses' ? 'id' : 'user_id',
      value = change === 'businesses' ? ids.a : ids.owner;
    await db.query(
      `update public.${change} set status='DISABLED' where ${key}=$1`,
      [value],
    );
    await actor(ids.owner, async () => {
      expect((await db.query('select id from rental_rate_cards')).rows).toEqual(
        [],
      );
    });
    await db.query(
      `update public.${change} set status='ACTIVE' where ${key}=$1`,
      [value],
    );
  }
  await actor(ids.owner, async () => {
    for (const table of ['rental_rate_cards', 'rental_quote_snapshots']) {
      for (const stmt of [
        `delete from ${table}`,
        `update ${table} set created_by=created_by`,
        `truncate ${table}`,
      ])
        await expect(db.exec(stmt)).rejects.toMatchObject({ code: '42501' });
    }
    await expect(card({ status: 'INACTIVE' })).rejects.toMatchObject({
      code: '42501',
    });
    await expect(snapshot(null)).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.exec('select public.protect_rental_quote_snapshot()'),
    ).rejects.toMatchObject({ code: '42501' });
  });
  const rls = await db.query<{ relrowsecurity: boolean }>(
    "select relrowsecurity from pg_class where relname in ('rental_rate_cards','rental_quote_snapshots')",
  );
  expect(rls.rows).toEqual([
    { relrowsecurity: true },
    { relrowsecurity: true },
  ]);
});
