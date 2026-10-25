import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
let db: PGlite;
let ids: Record<string, string>;
type Values = Record<string, string | number | boolean | null>;
async function insert(table: string, values: Values) {
  const columns = Object.keys(values);
  await db.query(
    `insert into public.${table}(${columns.join(',')}) values(${columns.map((_, i) => '$' + (i + 1)).join(',')})`,
    Object.values(values),
  );
}
async function batch(extra: Values = {}) {
  const id = randomUUID();
  await insert('toll_import_batches', {
    id,
    business_id: ids.a,
    source: 'Statement',
    idempotency_key: randomUUID(),
    content_hash: 'a'.repeat(64),
    row_count: 1,
    imported_count: 1,
    duplicate_count: 0,
    created_by: ids.owner,
    ...extra,
  });
  return id;
}
async function toll(extra: Values = {}) {
  const id = randomUUID();
  await insert('toll_transactions', {
    id,
    business_id: ids.a,
    batch_id: ids.batch,
    source: 'Statement',
    external_reference: randomUUID(),
    fingerprint: 'a'.repeat(64),
    plate: '51A12345',
    occurred_at: '2026-10-25T01:00:00Z',
    amount: '90000',
    import_row: 2,
    ...extra,
  });
  return id;
}
async function event(id: string, extra: Values = {}) {
  const eventId = randomUUID();
  await insert('toll_review_events', {
    id: eventId,
    business_id: ids.a,
    toll_transaction_id: id,
    action: 'IMPORTED',
    actor_id: ids.owner,
    reason: 'CSV statement import',
    status: 'UNMATCHED',
    version: 1,
    ...extra,
  });
  return eventId;
}
async function asActor(actor: string, operation: () => Promise<unknown>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    actor,
  ]);
  await db.exec('set role authenticated');
  try {
    return await operation();
  } finally {
    await db.exec('reset role');
  }
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
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
      'foreignVehicle',
      'rental',
      'foreignRental',
      'tenantCustomer',
      'foreignCustomer',
    ].map((key) => [key, randomUUID()]),
  );
  for (const key of ['owner', 'foreign', 'customer', 'platform']) {
    await db.query('insert into auth.users(id) values($1)', [ids[key]]);
    await insert('user_profiles', {
      user_id: ids[key],
      display_name: 'Toll fixture',
    });
  }
  await insert('platform_memberships', { user_id: ids.platform });
  for (const foreign of [false, true]) {
    const business = ids[foreign ? 'b' : 'a'];
    await insert('businesses', { id: business, name: 'Toll tenant' });
    await insert('business_memberships', {
      business_id: business,
      user_id: ids[foreign ? 'foreign' : 'owner'],
      role_key: 'OWNER',
    });
    await insert('vehicles', {
      id: ids[foreign ? 'foreignVehicle' : 'vehicle'],
      business_id: business,
      license_plate: foreign ? 'OTHER123' : 'OWN123',
      make: 'QA',
      model: 'Toll',
    });
    await insert('customers', {
      id: ids[foreign ? 'foreignCustomer' : 'tenantCustomer'],
      business_id: business,
      name: 'QA customer',
      phone: '12345',
    });
    await insert('rentals', {
      id: ids[foreign ? 'foreignRental' : 'rental'],
      business_id: business,
      vehicle_id: ids[foreign ? 'foreignVehicle' : 'vehicle'],
      customer_id: ids[foreign ? 'foreignCustomer' : 'tenantCustomer'],
      start_at: '2026-10-25T00:00:00Z',
      end_at: '2026-10-26T00:00:00Z',
    });
  }
  ids.batch = await batch();
});
afterAll(async () => db?.close());
it('replays clean schema, persists normalized data only and denies browser mutation privileges', async () => {
  const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
    'select relname,relrowsecurity from pg_class where relname=any($1::text[])',
    [['toll_import_batches', 'toll_transactions', 'toll_review_events']],
  );
  expect(tables.rows).toHaveLength(3);
  expect(tables.rows.every((row) => row.relrowsecurity)).toBe(true);
  const columns = await db.query<{ column_name: string; data_type: string }>(
    "select column_name,data_type from information_schema.columns where table_name in ('toll_import_batches','toll_transactions','toll_review_events')",
  );
  expect(
    columns.rows.some(
      (row) => row.data_type === 'bytea' || /csv|raw/i.test(row.column_name),
    ),
  ).toBe(false);
  for (const table of [
    'toll_import_batches',
    'toll_transactions',
    'toll_review_events',
  ])
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE'])
      expect(
        (
          await db.query<{ allowed: boolean }>(
            'select has_table_privilege($1,$2,$3) allowed',
            ['authenticated', 'public.' + table, privilege],
          )
        ).rows[0].allowed,
      ).toBe(false);
});
it('deduplicates references within business/source, fingerprints only reference-free rows and idempotency per business', async () => {
  await toll({ external_reference: 'REF' });
  await expect(toll({ external_reference: 'REF' })).rejects.toMatchObject({
    code: '23505',
  });
  await toll({
    external_reference: 'REF',
    source: 'Other source',
    batch_id: await batch({ source: 'Other source' }),
  });
  await toll({ external_reference: 'OTHERREF' });
  await toll({ external_reference: '' });
  await expect(toll({ external_reference: '' })).rejects.toMatchObject({
    code: '23505',
  });
  await toll({ external_reference: '', fingerprint: 'b'.repeat(64) });
  const key = randomUUID();
  await batch({ idempotency_key: key });
  await expect(batch({ idempotency_key: key })).rejects.toMatchObject({
    code: '23505',
  });
  await batch({ business_id: ids.b, idempotency_key: key });
});
it('enforces exact whole-VND bounds, normalized plates, row limits and valid review state', async () => {
  for (const extra of [
    { amount: '0' },
    { amount: '-1' },
    { amount: '1000000000000000' },
    { amount: 'NaN' },
    { plate: '51A-12.345' },
    { plate: 'a1234' },
    { import_row: 202 },
    { status: 'MATCHED' },
    { status: 'RECORDED', vehicle_id: ids.vehicle },
    { status: 'IGNORED' },
    { rental_id: ids.rental },
  ] as Values[])
    await expect(toll(extra)).rejects.toMatchObject({ code: '23514' });
  await toll({ amount: '999999999999999' });
  for (const extra of [
    { row_count: 201, imported_count: 201 },
    { source: ' ' },
    { content_hash: 'x' },
    { imported_count: 0 },
  ] as Values[])
    await expect(batch(extra)).rejects.toMatchObject({ code: '23514' });
});
it('rejects foreign tenant batch/vehicle/rental/movement and history snapshot links', async () => {
  const foreignBatch = await batch({ business_id: ids.b });
  await expect(toll({ batch_id: foreignBatch })).rejects.toMatchObject({
    code: '23503',
  });
  await expect(toll({ vehicle_id: ids.foreignVehicle })).rejects.toMatchObject({
    code: '23503',
  });
  await expect(
    toll({ vehicle_id: ids.vehicle, rental_id: ids.foreignRental }),
  ).rejects.toMatchObject({ code: '23503' });
  const movement = randomUUID();
  await insert('commercial_movements', {
    id: movement,
    business_id: ids.b,
    kind: 'EXPENSE',
    category: 'TOLL',
    amount: '90000',
    occurred_at: '2026-10-25T01:00:00Z',
    created_by: ids.foreign,
  });
  await expect(
    toll({
      vehicle_id: ids.vehicle,
      status: 'RECORDED',
      movement_id: movement,
      review_reason: 'Approved',
      reviewed_by: ids.owner,
      reviewed_at: '2026-10-25T02:00:00Z',
    }),
  ).rejects.toMatchObject({ code: '23514' });
  const id = await toll();
  await expect(event(id, { business_id: ids.b })).rejects.toMatchObject({
    code: '23503',
  });
  await expect(
    event(id, { vehicle_id: ids.foreignVehicle }),
  ).rejects.toMatchObject({ code: '23503' });
  await expect(event(id, { rental_id: ids.rental })).rejects.toMatchObject({
    code: '23514',
  });
});
it('keeps imported provenance, batches, reviewed snapshots and recorded rows immutable', async () => {
  const id = await toll();
  const eventId = await event(id);
  for (const statement of [
    'update toll_transactions set amount=1 where id=$1',
    'delete from toll_transactions where id=$1',
  ])
    await expect(db.query(statement, [id])).rejects.toMatchObject({
      code: '23001',
    });
  await expect(
    db.query('update toll_import_batches set row_count=2 where id=$1', [
      ids.batch,
    ]),
  ).rejects.toMatchObject({ code: '23001' });
  await expect(
    db.query('delete from toll_review_events where id=$1', [eventId]),
  ).rejects.toMatchObject({ code: '23001' });
  await db.query(
    "update toll_transactions set status='MATCHED',vehicle_id=$2,rental_id=$3,review_reason='Matched explicitly',reviewed_by=$4,reviewed_at=now(),version=version+1 where id=$1",
    [id, ids.vehicle, ids.rental, ids.owner],
  );
  await event(id, {
    action: 'MATCH_CONFIRMED',
    vehicle_id: ids.vehicle,
    rental_id: ids.rental,
    status: 'MATCHED',
    version: 2,
    reason: 'Matched explicitly',
  });
  const movement = randomUUID();
  await insert('commercial_movements', {
    id: movement,
    business_id: ids.a,
    vehicle_id: ids.vehicle,
    rental_id: ids.rental,
    kind: 'EXPENSE',
    category: 'TOLL',
    amount: '90000',
    occurred_at: '2026-10-25T01:00:00Z',
    created_by: ids.owner,
  });
  await db.query(
    "update toll_transactions set status='RECORDED',movement_id=$2,version=version+1 where id=$1",
    [id, movement],
  );
  await expect(
    db.query(
      "update toll_transactions set status='IGNORED',movement_id=null where id=$1",
      [id],
    ),
  ).rejects.toMatchObject({ code: '23001' });
  await expect(
    toll({
      vehicle_id: ids.vehicle,
      rental_id: ids.rental,
      status: 'RECORDED',
      movement_id: movement,
      review_reason: 'Duplicate',
      reviewed_by: ids.owner,
      reviewed_at: '2026-10-25T02:00:00Z',
    }),
  ).rejects.toMatchObject({ code: '23505' });
  const events = await db.query<{
    status: string;
    vehicle_id: string | null;
    version: number;
  }>(
    'select status,vehicle_id,version from toll_review_events where toll_transaction_id=$1 order by version',
    [id],
  );
  expect(events.rows).toEqual([
    { status: 'UNMATCHED', vehicle_id: null, version: 1 },
    { status: 'MATCHED', vehicle_id: ids.vehicle, version: 2 },
  ]);
});
it('allows only active tenant Owners to read imports/transactions/history, including revocation and platform/customer denial', async () => {
  const id = await toll();
  await event(id);
  for (const table of [
    'toll_import_batches',
    'toll_transactions',
    'toll_review_events',
  ]) {
    for (const actor of ['foreign', 'platform', 'customer'])
      expect(
        (
          (await asActor(ids[actor], () =>
            db.query(`select id from public.${table}`),
          )) as { rows: unknown[] }
        ).rows,
      ).toEqual([]);
    expect(
      (
        (await asActor(ids.owner, () =>
          db.query(`select id from public.${table}`),
        )) as { rows: unknown[] }
      ).rows,
    ).toHaveLength(1);
  }
  await db.query(
    "update user_profiles set status='DISABLED' where user_id=$1",
    [ids.owner],
  );
  expect(
    (
      (await asActor(ids.owner, () =>
        db.query('select id from toll_transactions'),
      )) as { rows: unknown[] }
    ).rows,
  ).toEqual([]);
  await db.query("update user_profiles set status='ACTIVE' where user_id=$1", [
    ids.owner,
  ]);
  await db.query(
    "update business_memberships set status='DISABLED' where user_id=$1",
    [ids.owner],
  );
  expect(
    (
      (await asActor(ids.owner, () =>
        db.query('select id from toll_transactions'),
      )) as { rows: unknown[] }
    ).rows,
  ).toEqual([]);
});
it('retains historical importer/reviewer identity after Auth/profile deletion without storing credentials', async () => {
  const id = await toll();
  await event(id);
  await db.query('delete from business_memberships where user_id=$1', [
    ids.owner,
  ]);
  await db.query('delete from user_profiles where user_id=$1', [ids.owner]);
  await db.query('delete from auth.users where id=$1', [ids.owner]);
  expect(
    (
      await db.query<{ created_by: string }>(
        'select created_by from toll_import_batches where id=$1',
        [ids.batch],
      )
    ).rows[0].created_by,
  ).toBe(ids.owner);
  expect(
    (
      await db.query<{ actor_id: string }>(
        'select actor_id from toll_review_events where toll_transaction_id=$1',
        [id],
      )
    ).rows[0].actor_id,
  ).toBe(ids.owner);
});

it('requires the immutable batch source and a matching original EXPENSE/TOLL movement', async () => {
  await expect(toll({ source: 'Forged batch source' })).rejects.toMatchObject({
    code: '23503',
  });
  const movement = randomUUID();
  await insert('commercial_movements', {
    id: movement,
    business_id: ids.a,
    vehicle_id: ids.vehicle,
    kind: 'EXPENSE',
    category: 'TOLL',
    amount: '90000',
    occurred_at: '2026-10-25T01:00:00Z',
    created_by: ids.owner,
  });
  for (const mismatch of [
    { amount: '80000' },
    { vehicle_id: ids.vehicle, rental_id: ids.rental },
    { occurred_at: '2026-10-25T02:00:00Z' },
  ] as Values[]) {
    await expect(
      toll({
        status: 'RECORDED',
        vehicle_id: ids.vehicle,
        movement_id: movement,
        review_reason: 'Approved',
        reviewed_by: ids.owner,
        reviewed_at: '2026-10-25T02:00:00Z',
        ...mismatch,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  }
  const wrongCategory = randomUUID();
  await insert('commercial_movements', {
    id: wrongCategory,
    business_id: ids.a,
    vehicle_id: ids.vehicle,
    kind: 'EXPENSE',
    category: 'FUEL',
    amount: '90000',
    occurred_at: '2026-10-25T01:00:00Z',
    created_by: ids.owner,
  });
  await expect(
    toll({
      status: 'RECORDED',
      vehicle_id: ids.vehicle,
      movement_id: wrongCategory,
      review_reason: 'Approved',
      reviewed_by: ids.owner,
      reviewed_at: '2026-10-25T02:00:00Z',
    }),
  ).rejects.toMatchObject({ code: '23514' });
});
