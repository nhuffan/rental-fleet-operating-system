import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
let db: PGlite;
let ids: Record<string, string>;
async function fixture() {
  ids = Object.fromEntries(
    [
      'a',
      'b',
      'owner',
      'otherOwner',
      'customer',
      'platform',
      'rental',
      'foreignRental',
      'vehicle',
      'foreignVehicle',
      'tenantCustomer',
      'foreignCustomer',
    ].map((k) => [k, randomUUID()]),
  );
  await db.exec(
    'truncate public.businesses,public.user_profiles,auth.users cascade',
  );
  for (const actor of ['owner', 'otherOwner', 'customer', 'platform']) {
    await db.query('insert into auth.users(id) values($1)', [ids[actor]]);
    await db.query(
      "insert into user_profiles(user_id,display_name) values($1,'Contract actor')",
      [ids[actor]],
    );
  }
  await db.query('insert into platform_memberships(user_id) values($1)', [
    ids.platform,
  ]);
  for (const [business, actor, vehicle, customer, rental] of [
    ['a', 'owner', 'vehicle', 'tenantCustomer', 'rental'],
    ['b', 'otherOwner', 'foreignVehicle', 'foreignCustomer', 'foreignRental'],
  ]) {
    await db.query(
      "insert into businesses(id,name) values($1,'Contract tenant')",
      [ids[business]],
    );
    await db.query(
      "insert into business_memberships(business_id,user_id,role_key) values($1,$2,'OWNER')",
      [ids[business], ids[actor]],
    );
    await db.query(
      "insert into vehicles(id,business_id,license_plate,make,model) values($1,$2,'OWN123','QA','Contract')",
      [ids[vehicle], ids[business]],
    );
    await db.query(
      "insert into customers(id,business_id,name,phone) values($1,$2,'Customer','0900000000')",
      [ids[customer], ids[business]],
    );
    await db.query(
      "insert into rentals(id,business_id,customer_id,vehicle_id,start_at,end_at) values($1,$2,$3,$4,'2027-01-01T00:00:00Z','2027-01-02T00:00:00Z')",
      [ids[rental], ids[business], ids[customer], ids[vehicle]],
    );
  }
}
async function insert(extra: Record<string, unknown> = {}) {
  const snapshot = {
    schemaVersion: 1,
    business: {},
    customer: {},
    vehicle: {},
    rental: { id: ids.rental },
    terms: 'Terms',
    missing: [],
  };
  const values: Record<string, unknown> = {
    id: randomUUID(),
    business_id: ids.a,
    rental_id: ids.rental,
    seq: 1,
    doc_number: 'HD-2026-000001',
    version: 1,
    content_hash: 'a'.repeat(64),
    snapshot: JSON.stringify(snapshot),
    issued_by: ids.owner,
    ...extra,
  };
  const keys = Object.keys(values);
  await db.query(
    `insert into rental_contract_documents(${keys.join(',')}) values(${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
    Object.values(values),
  );
  return values.id as string;
}
async function browser(actor: string, operation: () => Promise<unknown>) {
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
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const f of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('../../supabase/migrations/' + f, 'utf8'));
}, 30000);
beforeEach(fixture);
afterAll(async () => db?.close());
it('replays optional profile defaults and rejects untrimmed, oversized and invalid phone fields', async () => {
  const b = await db.query<{ legal_name: string; contract_terms: string }>(
    'select legal_name,contract_terms from businesses where id=$1',
    [ids.a],
  );
  expect(b.rows[0]).toEqual({ legal_name: '', contract_terms: '' });
  for (const [table, key, id, value] of [
    ['businesses', 'legal_name', ids.a, ' leading'],
    ['businesses', 'phone', ids.a, 'abc'],
    ['businesses', 'contract_terms', ids.a, 'x'.repeat(8001)],
    ['customers', 'id_number', ids.tenantCustomer, 'x'.repeat(33)],
    ['customers', 'address', ids.tenantCustomer, 'trailing '],
    ['customers', 'driver_license_class', ids.tenantCustomer, 'x'.repeat(9)],
  ])
    await expect(
      db.query(`update ${table} set ${key}=$2 where id=$1`, [id, value]),
    ).rejects.toMatchObject({ code: '23514' });
});
it('enforces document numbering uniqueness, shape, content size and tenant relationship', async () => {
  await insert();
  await expect(insert()).rejects.toMatchObject({ code: '23505' });
  await expect(
    insert({ seq: 2, doc_number: 'HD-2026-000002' }),
  ).rejects.toMatchObject({ code: '23505' });
  for (const extra of [
    { seq: 0, doc_number: 'HD-2026-000000', version: 2 },
    { seq: 2, doc_number: 'WRONG', version: 2 },
    { seq: 2, doc_number: 'HD-2026-000002', version: 2, content_hash: 'bad' },
    {
      seq: 2,
      doc_number: 'HD-2026-000002',
      version: 2,
      snapshot: JSON.stringify({
        schemaVersion: 1,
        business: {},
        customer: {},
        vehicle: {},
        rental: { id: ids.rental },
        terms: 'x'.repeat(65536),
        missing: [],
      }),
    },
  ])
    await expect(insert(extra)).rejects.toMatchObject({ code: '23514' });
  await expect(
    insert({
      business_id: ids.b,
      seq: 2,
      doc_number: 'HD-2026-000002',
      version: 2,
    }),
  ).rejects.toMatchObject({ code: '23503' });
});
it('makes issued documents immutable and preserves actor references after identity deletion', async () => {
  const id = await insert();
  for (const statement of [
    "update rental_contract_documents set doc_number='HD-2027-000001' where id=$1",
    'delete from rental_contract_documents where id=$1',
  ])
    await expect(db.query(statement, [id])).rejects.toMatchObject({
      code: '23001',
    });
  await db.query('delete from business_memberships where user_id=$1', [
    ids.owner,
  ]);
  await db.query('delete from user_profiles where user_id=$1', [ids.owner]);
  await db.query('delete from auth.users where id=$1', [ids.owner]);
  expect(
    (
      await db.query<{ issued_by: string }>(
        'select issued_by from rental_contract_documents where id=$1',
        [id],
      )
    ).rows[0].issued_by,
  ).toBe(ids.owner);
});
it('enables RLS, limits reads to active tenant Owners and denies all direct browser writes', async () => {
  await insert();
  expect(
    (
      await db.query(
        "select relrowsecurity from pg_class where oid='public.rental_contract_documents'::regclass",
      )
    ).rows,
  ).toEqual([{ relrowsecurity: true }]);
  for (const actor of ['otherOwner', 'customer', 'platform'])
    expect(
      (
        (await browser(ids[actor], () =>
          db.query('select id from rental_contract_documents'),
        )) as { rows: unknown[] }
      ).rows,
    ).toEqual([]);
  expect(
    (
      (await browser(ids.owner, () =>
        db.query('select id from rental_contract_documents'),
      )) as { rows: unknown[] }
    ).rows,
  ).toHaveLength(1);
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'])
    expect(
      (
        await db.query<{ allowed: boolean }>(
          'select has_table_privilege($1,$2,$3) allowed',
          ['authenticated', 'public.rental_contract_documents', privilege],
        )
      ).rows[0].allowed,
    ).toBe(false);
  await db.query("update businesses set status='DISABLED' where id=$1", [
    ids.a,
  ]);
  expect(
    (
      (await browser(ids.owner, () =>
        db.query('select id from rental_contract_documents'),
      )) as { rows: unknown[] }
    ).rows,
  ).toEqual([]);
});
