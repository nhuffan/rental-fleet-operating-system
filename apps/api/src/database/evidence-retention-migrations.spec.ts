import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
let db: PGlite;
let ids: Record<string, string>;
let backfilled = false;
type Values = Record<string, string | number | boolean | null>;
async function insert(table: string, values: Values) {
  const columns = Object.keys(values);
  await db.query(
    `insert into public.${table}(${columns.join(',')}) values (${columns.map((_, index) => '$' + (index + 1)).join(',')})`,
    Object.values(values),
  );
}
async function fixtures() {
  ids = Object.fromEntries(
    [
      'business',
      'otherBusiness',
      'owner',
      'otherOwner',
      'customer',
      'operator',
      'rental',
      'otherRental',
      'vehicle',
      'otherVehicle',
      'tenantCustomer',
      'otherCustomer',
    ].map((key) => [key, randomUUID()]),
  );
  for (const key of ['owner', 'otherOwner', 'customer', 'operator']) {
    await db.query('insert into auth.users(id) values($1)', [ids[key]]);
    await insert('user_profiles', {
      user_id: ids[key],
      display_name: 'Retention fixture',
    });
  }
  await insert('platform_memberships', { user_id: ids.operator });
  for (const other of [false, true]) {
    const business = ids[other ? 'otherBusiness' : 'business'];
    const vehicle = ids[other ? 'otherVehicle' : 'vehicle'];
    const customer = ids[other ? 'otherCustomer' : 'tenantCustomer'];
    await insert('businesses', { id: business, name: 'Retention tenant' });
    await insert('business_memberships', {
      business_id: business,
      user_id: ids[other ? 'otherOwner' : 'owner'],
      role_key: 'OWNER',
    });
    await insert('vehicles', {
      id: vehicle,
      business_id: business,
      license_plate: other ? 'RETOTHER' : 'RETOWN',
      make: 'QA',
      model: 'Retention',
    });
    await insert('customers', {
      id: customer,
      business_id: business,
      name: 'QA customer',
      phone: '12345',
    });
    await insert('rentals', {
      id: ids[other ? 'otherRental' : 'rental'],
      business_id: business,
      vehicle_id: vehicle,
      customer_id: customer,
      start_at: '2026-10-25T00:00:00Z',
      end_at: '2026-10-26T00:00:00Z',
    });
  }
}
async function attachment(other = false) {
  const business = ids[other ? 'otherBusiness' : 'business'];
  const rental = ids[other ? 'otherRental' : 'rental'];
  const vehicle = ids[other ? 'otherVehicle' : 'vehicle'];
  const owner = ids[other ? 'otherOwner' : 'owner'];
  const id = randomUUID();
  const inspection = randomUUID();
  const key = `b/${business}/rentals/${rental}/HANDOVER`;
  await insert('inspection_uploads', {
    id,
    business_id: business,
    rental_id: rental,
    vehicle_id: vehicle,
    type: 'HANDOVER',
    kind: 'IMAGE',
    category: 'FRONT',
    uploaded_by: owner,
    idempotency_key: randomUUID(),
    bucket: 'inspection-images',
    pending_key: `${key}/pending/${id}.jpg`,
    object_key: `${key}/evidence/${id}.jpg`,
    declared_mime: 'image/jpeg',
    declared_bytes: 500,
    expires_at: '2026-10-25T01:00:00Z',
    hold_until: '2026-10-25T03:00:00Z',
    reserved_bytes: 2097152,
  });
  await insert('rental_inspections', {
    id: inspection,
    business_id: business,
    rental_id: rental,
    vehicle_id: vehicle,
    type: 'HANDOVER',
    actor_id: owner,
    odometer: 1,
    fuel_percent: 80,
    exterior_condition: 'GOOD',
    interior_condition: 'GOOD',
    spare_tire: 'PRESENT',
    tools: 'PRESENT',
    registration_document: 'PRESENT',
    insurance_document: 'PRESENT',
    keys: 'PRESENT',
    notes: 'Immutable fixture',
  });
  await insert('inspection_evidence', {
    id,
    business_id: business,
    rental_id: rental,
    vehicle_id: vehicle,
    inspection_id: inspection,
    type: 'HANDOVER',
    kind: 'IMAGE',
    category: 'FRONT',
    uploaded_by: owner,
    bucket: 'inspection-images',
    object_key: `${key}/evidence/${id}.jpg`,
    mime_type: 'image/jpeg',
    bytes: 500,
    width: 640,
    height: 480,
  });
  return id;
}
async function hold(overrides: Values = {}) {
  await insert('evidence_rental_holds', {
    business_id: ids.business,
    rental_id: ids.rental,
    active: true,
    unresolved_dispute: true,
    reason: 'Unresolved case fixture',
    actor_id: ids.owner,
    ...overrides,
  });
}
async function event(evidenceId: string | null = null, overrides: Values = {}) {
  await insert('evidence_retention_events', {
    business_id: ids.business,
    rental_id: ids.rental,
    evidence_id: evidenceId,
    action: 'LEGAL_HOLD_SET',
    actor_id: ids.owner,
    reason: 'Case history fixture',
    ...overrides,
  });
}
async function asBrowser(
  actor: string,
  run: () => Promise<void>,
  role = 'authenticated',
) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    actor,
  ]);
  await db.exec(`set role ${role}`);
  try {
    await run();
  } finally {
    await db.exec('reset role');
  }
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  const migrations = readdirSync('../../supabase/migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of migrations) {
    if (file.endsWith('_evidence_retention_lifecycle.sql')) {
      await fixtures();
      const existing = await attachment();
      await db.exec(readFileSync('../../supabase/migrations/' + file, 'utf8'));
      const result = await db.query<{ evidence_id: string; status: string }>(
        'select evidence_id,status from public.evidence_lifecycles where evidence_id=$1',
        [existing],
      );
      const snapshot = await db.query<{ notes: string }>(
        'select notes from public.rental_inspections where rental_id=$1',
        [ids.rental],
      );
      backfilled =
        result.rows[0]?.status === 'ACTIVE' &&
        snapshot.rows[0]?.notes === 'Immutable fixture';
    } else
      await db.exec(readFileSync('../../supabase/migrations/' + file, 'utf8'));
  }
}, 30_000);
beforeEach(async () => {
  await db.exec(
    'truncate public.businesses, public.user_profiles, auth.users cascade',
  );
  await fixtures();
});
afterAll(async () => db?.close());
it('backfills attached evidence and initializes new lifecycle rows without changing immutable inspections', async () => {
  expect(backfilled).toBe(true);
  const id = await attachment();
  expect(
    (
      await db.query(
        'select evidence_id,business_id,rental_id,status,important,retry_count from public.evidence_lifecycles where evidence_id=$1',
        [id],
      )
    ).rows,
  ).toEqual([
    {
      evidence_id: id,
      business_id: ids.business,
      rental_id: ids.rental,
      status: 'ACTIVE',
      important: false,
      retry_count: 0,
    },
  ]);
});
it('limits policy windows and requires explicit reason, actor and unresolved-dispute protection', async () => {
  for (const days of [0, 29, 31, 91])
    await expect(
      insert('evidence_retention_settings', {
        business_id: ids.business,
        retention_days: days,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  await insert('evidence_retention_settings', { business_id: ids.business });
  expect(
    (
      await db.query(
        'select retention_days from public.evidence_retention_settings',
      )
    ).rows,
  ).toEqual([{ retention_days: 30 }]);
  await db.query(
    'update public.evidence_retention_settings set retention_days=90 where business_id=$1',
    [ids.business],
  );
  for (const overrides of [
    { reason: '' },
    { reason: '  ' },
    { reason: 'x'.repeat(2001) },
    { active: false, unresolved_dispute: true },
  ] as Values[])
    await expect(hold(overrides)).rejects.toMatchObject({ code: '23514' });
  await hold();
  await expect(
    db.query(
      'update public.evidence_rental_holds set active=false where business_id=$1',
      [ids.business],
    ),
  ).rejects.toMatchObject({ code: '23514' });
});
it('enforces composite tenant ownership and immutable lifecycle identity', async () => {
  const id = await attachment();
  await expect(hold({ rental_id: ids.otherRental })).rejects.toMatchObject({
    code: '23503',
  });
  await expect(
    event(id, { business_id: ids.otherBusiness, rental_id: ids.otherRental }),
  ).rejects.toMatchObject({ code: '23503' });
  await expect(
    event(null, { rental_id: ids.otherRental }),
  ).rejects.toMatchObject({ code: '23503' });
  await expect(
    db.query(
      'update public.evidence_lifecycles set business_id=$2 where evidence_id=$1',
      [id, ids.otherBusiness],
    ),
  ).rejects.toMatchObject({
    code: '23001',
    constraint: 'evidence_lifecycle_identity_immutable',
  });
  await expect(
    insert('evidence_lifecycles', {
      evidence_id: randomUUID(),
      business_id: ids.business,
      rental_id: ids.rental,
    }),
  ).rejects.toMatchObject({ code: '23503' });
});
it('requires bounded valid claims and tombstones while retaining immutable metadata', async () => {
  const id = await attachment();
  for (const fields of [
    "status='UNKNOWN'",
    'important=true',
    'retry_count=-1',
    'retry_count=1001',
    "last_error_code='provider body secret'",
    "status='PURGING'",
    "status='PURGED'",
    "lease_until='infinity'",
  ])
    await expect(
      db.query(
        'update public.evidence_lifecycles set ' +
          fields +
          ' where evidence_id=$1',
        [id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  await db.query(
    "update public.evidence_lifecycles set status='PURGING',lease_id=$2,lease_until=now()+interval '1 minute' where evidence_id=$1",
    [id, randomUUID()],
  );
  await db.query(
    "update public.evidence_lifecycles set status='RETRY_REQUIRED',lease_id=null,lease_until=null,retry_count=1,last_error_code='STORAGE_DELETE_FAILED',next_retry_at=now()+interval '1 minute' where evidence_id=$1",
    [id],
  );
  await db.query(
    "update public.evidence_lifecycles set status='PURGED',purged_at=now(),next_retry_at=null,last_error_code=null where evidence_id=$1",
    [id],
  );
  for (const sql of [
    'update public.evidence_lifecycles set updated_at=now() where evidence_id=$1',
    'delete from public.evidence_lifecycles where evidence_id=$1',
  ])
    await expect(db.query(sql, [id])).rejects.toMatchObject({
      code: '23001',
      constraint: 'evidence_lifecycle_immutable',
    });
  expect(
    (
      await db.query(
        'select bytes,width,height from public.inspection_evidence where id=$1',
        [id],
      )
    ).rows,
  ).toEqual([{ bytes: 500, width: 640, height: 480 }]);
  await expect(
    db.query('delete from public.inspection_evidence where id=$1', [id]),
  ).rejects.toMatchObject({
    code: '23001',
    constraint: 'inspection_evidence_immutable',
  });
  await expect(
    db.query(
      'update public.rental_inspections set fuel_percent=1 where rental_id=$1',
      [ids.rental],
    ),
  ).rejects.toMatchObject({ code: '23001' });
});
it('retains reasoned append-only hold history after historical identities are removed', async () => {
  const id = await attachment();
  for (const overrides of [
    { reason: null },
    { reason: ' ' },
    { actor_id: null },
    { action: 'UNKNOWN' },
  ] as Values[])
    await expect(event(id, overrides)).rejects.toMatchObject({ code: '23514' });
  await hold();
  await event(id);
  await event(id, {
    action: 'LEGAL_HOLD_RELEASED',
    reason: 'Case explicitly resolved',
  });
  for (const sql of [
    'update public.evidence_retention_events set reason=reason where business_id=$1',
    'delete from public.evidence_retention_events where business_id=$1',
  ])
    await expect(db.query(sql, [ids.business])).rejects.toMatchObject({
      code: '23001',
      constraint: 'evidence_retention_events_immutable',
    });
  await db.query('delete from public.business_memberships where user_id=$1', [
    ids.owner,
  ]);
  await db.query('delete from public.user_profiles where user_id=$1', [
    ids.owner,
  ]);
  await db.query('delete from auth.users where id=$1', [ids.owner]);
  expect(
    (
      await db.query(
        'select actor_id from public.evidence_retention_events where business_id=$1',
        [ids.business],
      )
    ).rows,
  ).toEqual([{ actor_id: ids.owner }, { actor_id: ids.owner }]);
});
it('permits only active Owners to read their own tenant lifecycle/settings/hold/history', async () => {
  const id = await attachment();
  await attachment(true);
  await insert('evidence_retention_settings', { business_id: ids.business });
  await insert('evidence_retention_settings', {
    business_id: ids.otherBusiness,
  });
  await hold();
  await event(id);
  for (const actor of ['owner', 'otherOwner', 'customer', 'operator'])
    await asBrowser(ids[actor], async () => {
      for (const table of [
        'evidence_retention_settings',
        'evidence_rental_holds',
        'evidence_lifecycles',
        'evidence_retention_events',
      ]) {
        const result = await db.query<{ business_id: string }>(
          'select business_id from public.' + table,
        );
        expect(
          result.rows.every(
            (row) =>
              row.business_id ===
              ids[actor === 'otherOwner' ? 'otherBusiness' : 'business'],
          ),
        ).toBe(true);
        if (actor === 'customer' || actor === 'operator')
          expect(result.rows).toEqual([]);
        else if (actor === 'owner') expect(result.rows.length).toBe(1);
      }
    });
  for (const [table, key, value] of [
    ['businesses', 'id', ids.business],
    ['user_profiles', 'user_id', ids.owner],
    ['business_memberships', 'user_id', ids.owner],
  ]) {
    await db.query(
      `update public.${table} set status='DISABLED' where ${key}=$1`,
      [value],
    );
    await asBrowser(ids.owner, async () => {
      expect(
        (await db.query('select * from public.evidence_lifecycles')).rows,
      ).toEqual([]);
      expect(
        (await db.query('select * from public.evidence_rental_holds')).rows,
      ).toEqual([]);
    });
    await db.query(
      `update public.${table} set status='ACTIVE' where ${key}=$1`,
      [value],
    );
  }
});
it('enables RLS and denies browser mutation, truncate, anonymous reads and trigger calls', async () => {
  const id = await attachment();
  await hold();
  await event(id);
  const tables = [
    'evidence_retention_settings',
    'evidence_rental_holds',
    'evidence_lifecycles',
    'evidence_retention_events',
  ];
  expect(
    (
      await db.query<{ relrowsecurity: boolean }>(
        'select relrowsecurity from pg_class where relname = any($1)',
        [tables],
      )
    ).rows,
  ).toEqual(Array.from({ length: 4 }, () => ({ relrowsecurity: true })));
  for (const role of ['anon', 'authenticated'])
    await asBrowser(
      role === 'anon' ? '' : ids.owner,
      async () => {
        for (const table of tables) {
          for (const sql of [
            `insert into public.${table}(business_id) values('${ids.business}')`,
            `update public.${table} set business_id=business_id`,
            `delete from public.${table}`,
            `truncate public.${table}`,
          ])
            await expect(db.exec(sql)).rejects.toMatchObject({ code: '42501' });
          if (role === 'anon')
            await expect(
              db.exec('select * from public.' + table),
            ).rejects.toMatchObject({ code: '42501' });
        }
        for (const name of [
          'initialize_evidence_lifecycle',
          'protect_evidence_lifecycle_tombstone',
          'prevent_evidence_retention_event_mutation',
        ])
          await expect(
            db.exec(`select public.${name}()`),
          ).rejects.toMatchObject({ code: '42501' });
      },
      role,
    );
});
