import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

let db: PGlite;
let ids: Record<string, string>;
type Values = Record<string, string | number | null>;
async function insert(table: string, values: Values) {
  const columns = Object.keys(values);
  await db.query(
    `insert into public.${table}(${columns.join(',')}) values (${columns.map((_, i) => `$${i + 1}`).join(',')})`,
    Object.values(values),
  );
}
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
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(`../../supabase/migrations/${file}`, 'utf8'));
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  ids = Object.fromEntries(
    [
      'business',
      'otherBusiness',
      'owner',
      'otherOwner',
      'coworker',
      'customer',
      'operator',
      'vehicle',
      'otherVehicle',
      'rental',
      'otherRental',
      'tenantCustomer',
      'otherCustomer',
    ].map((key) => [key, randomUUID()]),
  );
  await db.exec(
    'truncate public.businesses, public.user_profiles, auth.users cascade',
  );
  for (const actor of [
    'owner',
    'otherOwner',
    'coworker',
    'customer',
    'operator',
  ]) {
    await db.query('insert into auth.users(id) values ($1)', [ids[actor]]);
    await insert('user_profiles', {
      user_id: ids[actor],
      display_name: 'Evidence fixture',
    });
  }
  await insert('platform_memberships', { user_id: ids.operator });
  for (const prefix of ['', 'other']) {
    const business = ids[prefix ? 'otherBusiness' : 'business'];
    const vehicle = ids[prefix ? 'otherVehicle' : 'vehicle'];
    const customer = ids[prefix ? 'otherCustomer' : 'tenantCustomer'];
    await insert('businesses', { id: business, name: 'Evidence tenant' });
    await insert('business_memberships', {
      business_id: business,
      user_id: ids[prefix ? 'otherOwner' : 'owner'],
      role_key: 'OWNER',
    });
    await insert('vehicles', {
      id: vehicle,
      business_id: business,
      license_plate: prefix ? 'OTHER1' : 'OWN1',
      make: 'QA',
      model: 'Evidence',
    });
    await insert('customers', {
      id: customer,
      business_id: business,
      name: 'Customer',
      phone: '12345',
    });
    await insert('rentals', {
      id: ids[prefix ? 'otherRental' : 'rental'],
      business_id: business,
      vehicle_id: vehicle,
      customer_id: customer,
      start_at: '2026-10-24T00:00:00Z',
      end_at: '2026-10-25T00:00:00Z',
    });
  }
  await insert('business_memberships', {
    business_id: ids.business,
    user_id: ids.coworker,
    role_key: 'OWNER',
  });
});
function uploadValues(overrides: Values = {}): Values {
  const row: Values = {
    id: randomUUID(),
    business_id: ids.business,
    rental_id: ids.rental,
    vehicle_id: ids.vehicle,
    type: 'HANDOVER',
    kind: 'IMAGE',
    category: 'FRONT',
    uploaded_by: ids.owner,
    idempotency_key: randomUUID(),
    bucket: 'inspection-images',
    declared_mime: 'image/jpeg',
    declared_bytes: 500,
    expires_at: '2026-10-24T01:00:00Z',
    hold_until: '2026-10-24T03:00:00Z',
    reserved_bytes: 2097152,
    ...overrides,
  };
  const extension =
    (
      {
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
      } as Record<string, string>
    )[String(row.declared_mime)] ?? 'jpg';
  const prefix = `b/${row.business_id}/rentals/${row.rental_id}/${row.type}`;
  row.pending_key ??= `${prefix}/pending/${row.id}.${extension}`;
  row.object_key ??= `${prefix}/evidence/${row.id}.${extension}`;
  return row;
}
async function upload(overrides: Values = {}) {
  const row = uploadValues(overrides);
  await insert('inspection_uploads', row);
  return row;
}
async function inspection(overrides: Values = {}) {
  const row: Values = {
    id: randomUUID(),
    business_id: ids.business,
    rental_id: ids.rental,
    vehicle_id: ids.vehicle,
    type: 'HANDOVER',
    actor_id: ids.owner,
    odometer: 1,
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
  await insert('rental_inspections', row);
  return String(row.id);
}
async function attachment(
  row: Values,
  inspectionId: string,
  overrides: Values = {},
) {
  const values: Values = Object.fromEntries(
    [
      'id',
      'business_id',
      'rental_id',
      'vehicle_id',
      'type',
      'kind',
      'category',
      'uploaded_by',
      'bucket',
      'object_key',
    ].map((key) => [key, row[key]]),
  );
  Object.assign(
    values,
    {
      inspection_id: inspectionId,
      mime_type: row.declared_mime,
      bytes: 500,
      width: 640,
      height: 480,
      duration_seconds: null,
    },
    overrides,
  );
  await insert('inspection_evidence', values);
}
async function asBrowser(
  role: 'anon' | 'authenticated',
  actor: string,
  run: () => Promise<void>,
) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    actor,
  ]);
  await db.exec(`set role ${role}`);
  try {
    await run();
  } finally {
    await db.exec('reset role');
  }
}

it('replays a clean database and keeps binary content out of metadata tables', async () => {
  const columns = await db.query<{ data_type: string }>(
    "select data_type from information_schema.columns where table_schema='public' and table_name in ('inspection_uploads','inspection_evidence')",
  );
  expect(columns.rows.length).toBeGreaterThan(30);
  expect(columns.rows.some((row) => row.data_type === 'bytea')).toBe(false);
  expect(
    (
      await db.query(
        "select relrowsecurity from pg_class where oid in ('public.inspection_uploads'::regclass, 'public.inspection_evidence'::regclass)",
      )
    ).rows,
  ).toEqual([{ relrowsecurity: true }, { relrowsecurity: true }]);
});
it('enforces idempotency and tenant/vehicle/milestone associations in composite keys', async () => {
  const row = await upload();
  await expect(
    upload({ idempotency_key: row.idempotency_key }),
  ).rejects.toMatchObject({
    code: '23505',
    constraint: 'inspection_uploads_idempotency_unique',
  });
  await expect(
    upload({ business_id: ids.otherBusiness }),
  ).rejects.toMatchObject({ code: '23503' });
  await expect(upload({ vehicle_id: ids.otherVehicle })).rejects.toMatchObject({
    code: '23503',
  });
  const ownInspection = await inspection();
  const otherInspection = await inspection({
    business_id: ids.otherBusiness,
    rental_id: ids.otherRental,
    vehicle_id: ids.otherVehicle,
  });
  await expect(attachment(row, otherInspection)).rejects.toMatchObject({
    code: '23503',
    constraint: 'inspection_evidence_inspection_tenant_fk',
  });
  await expect(
    attachment(row, ownInspection, {
      type: 'RETURN',
      object_key: String(row.object_key).replace('/HANDOVER/', '/RETURN/'),
    }),
  ).rejects.toMatchObject({ code: '23503' });
  const unstagedId = randomUUID();
  await expect(
    attachment({ ...row, id: unstagedId }, ownInspection, {
      object_key: `b/${ids.business}/rentals/${ids.rental}/HANDOVER/evidence/${unstagedId}.jpg`,
    }),
  ).rejects.toMatchObject({
    code: '23503',
    constraint: 'inspection_evidence_upload_tenant_fk',
  });
  await attachment(row, ownInspection);
});
it('rejects unbounded declarations, forged paths, invalid states and incomplete verified metadata', async () => {
  const invalid: Values[] = [
    { declared_bytes: 0 },
    { declared_bytes: 1048577 },
    { declared_mime: 'image/png' },
    { kind: 'AUDIO' },
    { bucket: 'public' },
    { type: 'OLD_HANDOVER' },
    { category: 'UNKNOWN' },
    { status: 'READY' },
    { pending_key: 'forged.jpg' },
    { object_key: '../forged.jpg' },
    { status: 'VERIFIED' },
    { width: 1921 },
    { height: -1 },
    { bytes: 1048577 },
    { reserved_bytes: -1 },
    { reserved_bytes: 25165825 },
    { expires_at: 'infinity' },
    {
      kind: 'VIDEO',
      bucket: 'inspection-videos',
      declared_mime: 'video/mp4',
      declared_bytes: 12582913,
    },
    {
      kind: 'VIDEO',
      bucket: 'inspection-videos',
      declared_mime: 'video/mp4',
      duration_seconds: 31,
    },
  ];
  for (const overrides of invalid)
    await expect(upload(overrides)).rejects.toMatchObject({ code: '23514' });
  await upload({
    kind: 'VIDEO',
    bucket: 'inspection-videos',
    declared_mime: 'video/webm',
    declared_bytes: 12582912,
  });
  await upload({
    status: 'VERIFIED',
    mime_type: 'image/jpeg',
    bytes: 1048576,
    width: 1920,
    height: 1080,
    verified_at: '2026-10-24T00:30:00Z',
  });
});
it('enforces final media limits and immutable evidence even for the trusted database role', async () => {
  const row = await upload();
  const inspectionId = await inspection();
  for (const overrides of [
    { bytes: 1048577 },
    { width: 1921 },
    { mime_type: 'text/html' },
    { duration_seconds: 1 },
    { object_key: 'forged.jpg' },
  ] as Values[])
    await expect(
      attachment(row, inspectionId, overrides),
    ).rejects.toMatchObject({ code: '23514' });
  await attachment(row, inspectionId);
  for (const statement of [
    'update public.inspection_evidence set category=category where id=$1',
    'delete from public.inspection_evidence where id=$1',
  ])
    await expect(db.query(statement, [row.id])).rejects.toMatchObject({
      code: '23001',
      constraint: 'inspection_evidence_immutable',
    });
  await expect(
    db.query('delete from public.inspection_uploads where id=$1', [row.id]),
  ).rejects.toMatchObject({
    code: '23001',
    constraint: 'inspection_evidence_upload_tenant_fk',
  });
  await expect(
    db.query('delete from public.rentals where id=$1', [ids.rental]),
  ).rejects.toBeDefined();
});
it('allows active Owner reads only in their tenant, with staging further restricted to its uploader', async () => {
  const own = await upload();
  await attachment(own, await inspection());
  const other = await upload({
    business_id: ids.otherBusiness,
    rental_id: ids.otherRental,
    vehicle_id: ids.otherVehicle,
    uploaded_by: ids.otherOwner,
  });
  await attachment(
    other,
    await inspection({
      business_id: ids.otherBusiness,
      rental_id: ids.otherRental,
      vehicle_id: ids.otherVehicle,
    }),
  );
  for (const [actor, uploadId, evidenceId] of [
    [ids.owner, own.id, own.id],
    [ids.coworker, null, own.id],
    [ids.otherOwner, other.id, other.id],
    [ids.customer, null, null],
    [ids.operator, null, null],
  ]) {
    await asBrowser('authenticated', String(actor), async () => {
      expect(
        (await db.query('select id from public.inspection_uploads')).rows,
      ).toEqual(uploadId ? [{ id: uploadId }] : []);
      expect(
        (await db.query('select id from public.inspection_evidence')).rows,
      ).toEqual(evidenceId ? [{ id: evidenceId }] : []);
    });
  }
});
it('revokes reads as soon as a profile, membership or business is disabled', async () => {
  const row = await upload();
  await attachment(row, await inspection());
  for (const [table, key, id] of [
    ['user_profiles', 'user_id', ids.owner],
    ['business_memberships', 'user_id', ids.owner],
    ['businesses', 'id', ids.business],
  ]) {
    await db.query(
      `update public.${table} set status='DISABLED' where ${key}=$1`,
      [id],
    );
    await asBrowser('authenticated', ids.owner, async () => {
      expect(
        (await db.query('select id from public.inspection_uploads')).rows,
      ).toEqual([]);
      expect(
        (await db.query('select id from public.inspection_evidence')).rows,
      ).toEqual([]);
    });
    await db.query(
      `update public.${table} set status='ACTIVE' where ${key}=$1`,
      [id],
    );
  }
});
it('denies browser writes, truncation, anonymous reads and direct trigger calls', async () => {
  const row = await upload();
  await attachment(row, await inspection());
  for (const role of ['anon', 'authenticated'] as const)
    await asBrowser(
      role,
      role === 'authenticated' ? ids.owner : '',
      async () => {
        for (const table of ['inspection_uploads', 'inspection_evidence']) {
          for (const statement of [
            `insert into public.${table}(id) values ('${randomUUID()}')`,
            `update public.${table} set category='OTHER'`,
            `delete from public.${table}`,
            `truncate public.${table}`,
          ])
            await expect(db.exec(statement)).rejects.toMatchObject({
              code: '42501',
            });
          if (role === 'anon')
            await expect(
              db.exec(`select * from public.${table}`),
            ).rejects.toMatchObject({ code: '42501' });
        }
        await expect(
          db.exec('select public.prevent_inspection_evidence_mutation()'),
        ).rejects.toMatchObject({ code: '42501' });
      },
    );
});
it('retains historical uploader references after profile and Auth identity removal', async () => {
  const row = await upload();
  await attachment(row, await inspection());
  await db.query('delete from public.business_memberships where user_id=$1', [
    ids.owner,
  ]);
  await db.query('delete from public.user_profiles where user_id=$1', [
    ids.owner,
  ]);
  await db.query('delete from auth.users where id=$1', [ids.owner]);
  expect(
    (await db.query('select uploaded_by from public.inspection_uploads')).rows,
  ).toEqual([{ uploaded_by: ids.owner }]);
  expect(
    (await db.query('select uploaded_by from public.inspection_evidence')).rows,
  ).toEqual([{ uploaded_by: ids.owner }]);
});
