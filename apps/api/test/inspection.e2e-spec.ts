import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { disposableFixture } from './disposable-fixture.js';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/http.js';
import { Database } from '../dist/database/database.js';
import { loadConfig } from '../dist/config.js';

const fixture = disposableFixture({ includeCustomer: true });
const owned = fixture.data;
let app: INestApplication | undefined;
let database: Database | undefined;
let expectedSnapshots = 0;
const inspection = {
  fuelPercent: 80,
  exteriorCondition: 'GOOD',
  interiorCondition: 'GOOD',
  spareTire: 'NOT_APPLICABLE',
  tools: 'PRESENT',
  registrationDocument: 'PRESENT',
  insuranceDocument: 'PRESENT',
  keys: 'PRESENT',
};
const returnInspection = {
  ...inspection,
  fuelPercent: 45,
  exteriorCondition: 'DAMAGED',
  tools: 'MISSING',
  damageNotes: 'Synthetic inspection rear door dent',
  notes: 'Synthetic private inspection return note',
};
function api(actor = 'ownerA', business = owned.businessA) {
  if (!app) throw new Error('Inspection app unavailable');
  const server = app.getHttpServer();
  const headers = {
    Authorization: 'Bearer ' + fixture.tokens[actor],
    'X-Business-Id': business,
  };
  return {
    get: (path: string) =>
      request(server)
        .get('/api/v1' + path)
        .set(headers),
    post: (path: string, body: object) =>
      request(server)
        .post('/api/v1' + path)
        .set(headers)
        .send(body),
  };
}
beforeAll(async () => {
  process.env.LOG_REQUESTS = 'false';
  await fixture.start();
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  database = app.get(Database);
}, 120000);
afterAll(async () => {
  try {
    await fixture.cleanup();
    if (database && expectedSnapshots) {
      const retained = await database.pool.query<{
        status: string;
        snapshots: number;
        rentals: number;
        vehicles: number;
        customers: number;
        branches: number;
        memberships: number;
      }>(
        `select b.status,
          (select count(*)::int from public.rental_inspections i where i.business_id=b.id) snapshots,
          (select count(*)::int from public.rentals r where r.business_id=b.id) rentals,
          (select count(*)::int from public.vehicles v where v.business_id=b.id) vehicles,
          (select count(*)::int from public.customers c where c.business_id=b.id) customers,
          (select count(*)::int from public.branches br where br.business_id=b.id) branches,
          (select count(*)::int from public.business_memberships m where m.business_id=b.id) memberships
        from public.businesses b where b.id=$1`,
        [owned.businessA],
      );
      expect(retained.rows).toEqual([
        {
          status: 'DISABLED',
          snapshots: expectedSnapshots,
          rentals: 1,
          vehicles: 1,
          customers: 1,
          branches: 1,
          memberships: 0,
        },
      ]);
      const profiles = await database.pool.query<{ status: string }>(
        'select status from public.user_profiles where user_id=any($1::uuid[])',
        [Object.values(owned.accounts).map((account) => account.id)],
      );
      // Auth deletion cascades profiles; any retained row must be disabled.
      expect(
        profiles.rows.every((profile) => profile.status === 'DISABLED'),
      ).toBe(true);
      const identities = await database.pool.query<{ remaining: number }>(
        'select count(*)::int remaining from auth.users where id=any($1::uuid[])',
        [Object.values(owned.accounts).map((account) => account.id)],
      );
      expect(identities.rows[0].remaining).toBe(0);
    }
  } finally {
    await app?.close();
  }
}, 60000);

it('records real atomic inspections under concurrent actions, protects tenant/Owner access and retains immutable history without charges', async () => {
  const vehicle = await api()
    .post('/vehicles', {
      licensePlate:
        'I' + randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
      make: 'Synthetic',
      model: 'Inspection fixture',
      branchId: owned.branchA,
    })
    .expect(201);
  const customer = await api()
    .post('/customers', {
      name: 'Synthetic inspection customer',
      phone: '0900000014',
    })
    .expect(201);
  const rental = await api()
    .post('/rentals', {
      vehicleId: vehicle.body.id as string,
      customerId: customer.body.id as string,
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: new Date(Date.now() + 3_600_000).toISOString(),
      rentalAmount: 100000,
      depositRequiredAmount: 50000,
    })
    .expect(201);
  const rentalId = rental.body.id as string;
  const vehicleId = vehicle.body.id as string;
  const snapshotsPath = `/rentals/${rentalId}/inspections`;
  const latestPath = `/vehicles/${vehicleId}/latest-inspection`;
  const handoverPath = `/rentals/${rentalId}/handover`;
  const returnPath = `/rentals/${rentalId}/return`;
  await request(app!.getHttpServer())
    .get('/api/v1' + snapshotsPath)
    .expect(401);
  expect((await api().get(snapshotsPath).expect(200)).body.data).toEqual([]);
  expect((await api().get(latestPath).expect(200)).body.inspection).toBeNull();
  await api().post(`/rentals/${rentalId}/reserve`, {}).expect(201);
  for (const body of [
    { odometerStart: 1000 },
    { odometerStart: 1000, inspection: null },
    { odometerStart: 1000, inspection: { ...inspection, fuelPercent: 101 } },
    {
      odometerStart: 1000,
      inspection: {
        ...inspection,
        exteriorCondition: 'DAMAGED',
        damageNotes: ' ',
      },
    },
    {
      odometerStart: 1000,
      inspection: {
        ...inspection,
        businessId: owned.businessB,
        rentalId: randomUUID(),
        vehicleId: randomUUID(),
        actorId: owned.accounts.platformOperator.id,
        recordedAt: new Date().toISOString(),
        type: 'RETURN',
        odometer: 1,
      },
    },
  ])
    await api().post(handoverPath, body).expect(400);
  expect((await api().get(snapshotsPath).expect(200)).body.data).toEqual([]);
  expect(
    (await api().get(`/rentals/${rentalId}`).expect(200)).body.status,
  ).toBe('RESERVED');

  const handoverRace = await Promise.all([
    api().post(handoverPath, { odometerStart: 1000, inspection }),
    api().post(handoverPath, { odometerStart: 1000, inspection }),
  ]);
  expect(
    handoverRace.map((response) => response.status).sort((a, b) => a - b),
  ).toEqual([201, 409]);
  expectedSnapshots = 1;
  const active = handoverRace.find((response) => response.status === 201)!
    .body as { handedOverAt: string };
  const handover = (await api().get(snapshotsPath).expect(200)).body
    .data[0] as Record<string, unknown>;
  expect(handover).toMatchObject({
    businessId: owned.businessA,
    rentalId,
    vehicleId,
    type: 'HANDOVER',
    actorId: owned.accounts.ownerA.id,
    recordedAt: active.handedOverAt,
    odometer: 1000,
    ...inspection,
    damageNotes: '',
    notes: '',
  });
  await api()
    .post(returnPath, { odometerEnd: 999, inspection: returnInspection })
    .expect(400);
  await api().post(returnPath, { odometerEnd: 1250 }).expect(400);
  expect((await api().get(snapshotsPath).expect(200)).body.data).toHaveLength(
    1,
  );
  expect(
    (await api().get(`/rentals/${rentalId}`).expect(200)).body.status,
  ).toBe('ACTIVE');
  const returnRace = await Promise.all([
    api().post(returnPath, { odometerEnd: 1250, inspection: returnInspection }),
    api().post(returnPath, { odometerEnd: 1250, inspection: returnInspection }),
  ]);
  expect(
    returnRace.map((response) => response.status).sort((a, b) => a - b),
  ).toEqual([201, 409]);
  expectedSnapshots = 2;
  const completed = returnRace.find((response) => response.status === 201)!
    .body as { returnedAt: string; status: string };
  expect(completed.status).toBe('COMPLETED');
  const snapshots = (await api().get(snapshotsPath).expect(200)).body as {
    rentalId: string;
    vehicleId: string;
    data: Array<{ id: string; type: string; actorId: string }>;
  };
  expect(snapshots).toMatchObject({ rentalId, vehicleId });
  expect(snapshots.data.map((snapshot) => snapshot.type)).toEqual([
    'HANDOVER',
    'RETURN',
  ]);
  expect(snapshots.data[1]).toMatchObject({
    type: 'RETURN',
    actorId: owned.accounts.ownerA.id,
    recordedAt: completed.returnedAt,
    odometer: 1250,
    ...returnInspection,
  });
  expect((await api().get(latestPath).expect(200)).body.inspection).toEqual(
    snapshots.data[1],
  );

  for (const path of [snapshotsPath, latestPath]) {
    await api('ownerB', owned.businessB).get(path).expect(404);
    for (const actor of [
      'platformOperator',
      'customer',
      'noMembership',
      'disabledA',
    ])
      await api(actor).get(path).expect(403);
  }
  await api('ownerA', owned.businessB).get(snapshotsPath).expect(403);
  await api('ownerB', owned.businessB)
    .post(handoverPath, { odometerStart: 1000, inspection })
    .expect(404);
  await api('ownerB', owned.businessB)
    .post(returnPath, { odometerEnd: 1250, inspection })
    .expect(404);
  for (const actor of [
    'platformOperator',
    'customer',
    'noMembership',
    'disabledA',
  ])
    await api(actor)
      .post(returnPath, { odometerEnd: 1250, inspection })
      .expect(403);

  const noCharges = await database!.pool.query<{ total: number }>(
    'select count(*)::int total from public.commercial_movements where business_id=$1 and rental_id=$2',
    [owned.businessA, rentalId],
  );
  expect(noCharges.rows[0].total).toBe(0);
  const audit = await database!.pool.query<{
    action: string;
    metadata: { fields: string[] };
  }>(
    "select action,metadata from public.audit_logs where business_id=$1 and entity_id=$2 and action in ('rental.handover','rental.return') order by created_at,id",
    [owned.businessA, rentalId],
  );
  expect(audit.rows.map((event) => event.action)).toEqual([
    'rental.handover',
    'rental.return',
  ]);
  expect(
    audit.rows.every((event) => event.metadata.fields.includes('inspection')),
  ).toBe(true);
  expect(JSON.stringify(audit.rows)).not.toContain(
    returnInspection.damageNotes,
  );
  expect(JSON.stringify(audit.rows)).not.toContain(returnInspection.notes);
  for (const statement of [
    'update public.rental_inspections set notes=$3 where business_id=$1 and id=$2',
    'delete from public.rental_inspections where business_id=$1 and id=$2 and $3::text is not null',
  ])
    await expect(
      database!.pool.query(statement, [
        owned.businessA,
        snapshots.data[0].id,
        'forbidden',
      ]),
    ).rejects.toMatchObject({ code: '23001' });
  expect((await api().get(snapshotsPath).expect(200)).body.data).toEqual(
    snapshots.data,
  );

  const config = loadConfig();
  const rest = `${config.supabaseUrl}/rest/v1/rental_inspections`;
  const ownerHeaders = {
    apikey: config.publishableKey,
    Authorization: 'Bearer ' + fixture.tokens.ownerA,
  };
  const directRead = await fetch(
    `${rest}?select=id,business_id&rental_id=eq.${rentalId}`,
    { headers: ownerHeaders },
  );
  expect(directRead.status).toBe(200);
  expect(await directRead.json()).toEqual(
    expect.arrayContaining(
      snapshots.data.map((snapshot) => ({
        id: snapshot.id,
        business_id: owned.businessA,
      })),
    ),
  );
  const hidden = await fetch(`${rest}?select=id&rental_id=eq.${rentalId}`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: 'Bearer ' + fixture.tokens.ownerB,
    },
  });
  expect(hidden.status).toBe(200);
  expect(await hidden.json()).toEqual([]);
  for (const method of ['PATCH', 'DELETE']) {
    const denied = await fetch(`${rest}?id=eq.${snapshots.data[0].id}`, {
      method,
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      ...(method === 'PATCH'
        ? { body: JSON.stringify({ notes: 'forbidden' }) }
        : {}),
    });
    expect(denied.status).toBe(403);
  }
  const anonymous = await fetch(`${rest}?select=id&rental_id=eq.${rentalId}`, {
    headers: { apikey: config.publishableKey },
  });
  expect([401, 403]).toContain(anonymous.status);
}, 120000);
