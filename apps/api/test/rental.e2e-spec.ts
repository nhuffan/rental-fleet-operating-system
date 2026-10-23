import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { disposableFixture } from './disposable-fixture.js';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/http.js';
import { Database } from '../dist/database/database.js';
import { loadConfig } from '../dist/config.js';

const fixture = disposableFixture();
const demo = fixture.data;
const tokens = fixture.tokens;
let app: INestApplication | undefined;
let database: Database | undefined;
const stamp = () => randomUUID().replaceAll('-', '');
const iso = (minutes: number) =>
  new Date(Date.now() + minutes * 60000).toISOString();
function api(actor = 'ownerA', business = demo.businessA) {
  if (!app) throw new Error('Rental E2E app unavailable');
  const server = app.getHttpServer();
  const headers = {
    Authorization: 'Bearer ' + tokens[actor],
    'X-Business-Id': business,
  };
  return {
    get: (path: string) =>
      request(server)
        .get('/api/v1' + path)
        .set(headers),
    post: (path: string) =>
      request(server)
        .post('/api/v1' + path)
        .set(headers),
    patch: (path: string) =>
      request(server)
        .patch('/api/v1' + path)
        .set(headers),
  };
}
async function vehicle(actor = 'ownerA', business = demo.businessA) {
  const r = await api(actor, business)
    .post('/vehicles')
    .send({
      licensePlate: 'R' + stamp().slice(0, 14).toUpperCase(),
      make: 'QA',
      model: 'Disposable Stage 4 E2E',
    })
    .expect(201);

  return r.body as { id: string; status: string };
}
async function customer(
  actor = 'ownerA',
  business = demo.businessA,
  extra: Record<string, unknown> = {},
) {
  const r = await api(actor, business)
    .post('/customers')
    .send({
      name: 'Disposable Stage 4 ' + stamp(),
      phone: '+84 900 123 456',
      email: '',
      notes: 'Synthetic development E2E',
      ...extra,
    })
    .expect(201);

  return r.body as {
    id: string;
    name: string;
    phone: string;
    email: string;
    status: string;
  };
}
async function rental(
  v: string,
  c: string,
  extra: Record<string, unknown> = {},
  actor = 'ownerA',
  business = demo.businessA,
) {
  const r = await api(actor, business)
    .post('/rentals')
    .send({
      vehicleId: v,
      customerId: c,
      startAt: iso(-5),
      endAt: iso(90),
      rentalAmount: 1250000.5,
      depositRequiredAmount: 500000,
      depositReceived: false,
      notes: 'Synthetic Stage 4 rental',
      ...extra,
    })
    .expect(201);

  return r.body as {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
  };
}
const action = (id: string, name: string) => `/rentals/${id}/${name}`;
const availability = (start: string, end: string) =>
  '/vehicles/availability?' +
  new URLSearchParams({ startAt: start, endAt: end, limit: '100' }).toString();
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
  } finally {
    await app?.close();
  }
}, 60000);

it('authorizes Owner Customer/Rental management and denies ungranted access', async () => {
  await request(app!.getHttpServer()).get('/api/v1/customers').expect(401);
  await request(app!.getHttpServer()).get('/api/v1/rentals').expect(401);
  const me = await api('ownerA').get('/me').expect(200);
  expect(me.body.permissions).toEqual(
    expect.arrayContaining([
      'customer.read',
      'customer.manage',
      'rental.read',
      'rental.manage',
    ]),
  );
  await api('noMembership').get('/me').expect(403);
  const c = await customer('ownerA');
  const v = await vehicle('ownerA');
  const r = await rental(v.id, c.id, {}, 'ownerA');
  for (const path of [
    '/customers',
    '/customers/' + c.id,
    '/rentals',
    '/rentals/' + r.id,
    availability(iso(1), iso(60)),
    `/vehicles/${v.id}/rental-state`,
  ]) {
    await api('ownerA').get(path).expect(200);
    await api('noMembership').get(path).expect(403);
  }
  await api('noMembership')
    .post('/customers')
    .send({ name: 'Forbidden', phone: '0900123456' })
    .expect(403);
  await api('noMembership')
    .patch('/customers/' + c.id)
    .send({ name: 'Forbidden' })
    .expect(403);
  await api('noMembership')
    .post('/rentals')
    .send({
      vehicleId: v.id,
      customerId: c.id,
      startAt: iso(1),
      endAt: iso(60),
    })
    .expect(403);
  await api('noMembership')
    .patch('/rentals/' + r.id)
    .send({ notes: 'Forbidden' })
    .expect(403);
  for (const [name, body] of [
    ['reserve', {}],
    ['handover', { odometerStart: 10 }],
    ['extend', { endAt: iso(120) }],
    ['return', { odometerEnd: 20 }],
    ['cancel', {}],
  ] as const)
    await api('noMembership').post(action(r.id, name)).send(body).expect(403);
});

it('validates contacts, money, dates and immutable lifecycle inputs', async () => {
  for (const body of [
    { name: 'No contact' },
    { name: 'Bad phone', phone: '<script>' },
    { name: 'Bad email', email: 'invalid' },
    { name: 'Injected', phone: '0900123456', businessId: demo.businessB },
  ])
    await api().post('/customers').send(body).expect(400);
  const c = await customer('ownerA', demo.businessA, {
    email: '  SYNTHETIC@EXAMPLE.TEST  ',
  });
  expect(c.email).toBe('synthetic@example.test');
  const sharedContact = await customer('ownerA', demo.businessA, {
    phone: c.phone,
    email: c.email,
  });
  expect(sharedContact.id).not.toBe(c.id);
  await api()
    .patch('/customers/' + c.id)
    .send({ phone: '', email: '' })
    .expect(400);
  const v = await vehicle();
  const valid = {
    vehicleId: v.id,
    customerId: c.id,
    startAt: iso(1),
    endAt: iso(60),
  };
  for (const extra of [
    { endAt: valid.startAt },
    { startAt: '2026-10-22T10:00:00' },
    { rentalAmount: -1 },
    { rentalAmount: 1.001 },
    { status: 'ACTIVE' },
    { odometerStart: 100 },
    { businessId: demo.businessB },
  ])
    await api()
      .post('/rentals')
      .send({ ...valid, ...extra })
      .expect(400);
  await api().get('/rentals?status=OVERDUE').expect(400);
  await api().get('/rentals?page=0').expect(400);
  await api().get('/customers?sort=businessId').expect(400);
  await api()
    .get(availability(iso(60), iso(1)))
    .expect(400);
  await api().get('/vehicles/availability').expect(400);
});

it('runs Customer → Draft → Reserve → Handover → Extend → Return with atomic redacted audit', async () => {
  const c = await customer('ownerA');
  const v = await vehicle('ownerA');
  const r = await rental(v.id, c.id, {}, 'ownerA');
  expect(r.status).toBe('DRAFT');
  await api('ownerA')
    .patch('/rentals/' + r.id)
    .send({
      notes: 'Private synthetic note not for audit',
      depositReceived: true,
    })
    .expect(200);
  const reserved = await api('ownerA')
    .post(action(r.id, 'reserve'))
    .expect(201);
  expect(reserved.body.status).toBe('RESERVED');
  expect(reserved.body.reservedAt).toBeTruthy();
  await api().post(action(r.id, 'reserve')).expect(409);
  for (const path of ['/vehicles/' + v.id, '/customers/' + c.id])
    await api().patch(path).send({ status: 'INACTIVE' }).expect(409);
  const handover = await api('ownerA')
    .post(action(r.id, 'handover'))
    .send({ odometerStart: 12000 })
    .expect(201);
  expect(handover.body.status).toBe('ACTIVE');
  expect(handover.body.odometerStart).toBe(12000);
  expect(handover.body.handedOverAt).toBeTruthy();
  await api()
    .post(action(r.id, 'handover'))
    .send({ odometerStart: 12000 })
    .expect(409);
  await api()
    .patch('/rentals/' + r.id)
    .send({ vehicleId: (await vehicle()).id })
    .expect(409);
  const nextEnd = iso(180);
  const extended = await api('ownerA')
    .post(action(r.id, 'extend'))
    .send({ endAt: nextEnd, rentalAmount: 1500000 })
    .expect(201);
  expect(extended.body.endAt).toBe(nextEnd);
  expect(extended.body.rentalAmount).toBe(1500000);
  await api().post(action(r.id, 'extend')).send({ endAt: nextEnd }).expect(400);
  await api()
    .post(action(r.id, 'return'))
    .send({ odometerEnd: 11999 })
    .expect(400);
  const current = await api().get(`/vehicles/${v.id}/rental-state`).expect(200);
  expect(current.body.state).toBe('RENTED');
  expect(current.body.currentRental.id).toBe(r.id);
  const returned = await api('ownerA')
    .post(action(r.id, 'return'))
    .send({ odometerEnd: 12240 })
    .expect(201);
  expect(returned.body.status).toBe('COMPLETED');
  expect(returned.body.odometerEnd).toBe(12240);
  expect(returned.body.returnedAt).toBeTruthy();
  expect(new Date(returned.body.returnedAt).getTime()).toBeGreaterThanOrEqual(
    new Date(handover.body.handedOverAt).getTime(),
  );
  await api()
    .post(action(r.id, 'return'))
    .send({ odometerEnd: 12240 })
    .expect(409);
  await api().post(action(r.id, 'cancel')).expect(409);
  await api()
    .patch('/rentals/' + r.id)
    .send({ notes: 'Terminal mutation' })
    .expect(409);
  const detail = await api()
    .get('/rentals/' + r.id)
    .expect(200);
  expect(detail.body.customer.id).toBe(c.id);
  expect(detail.body.vehicle.id).toBe(v.id);
  const fleet = await api()
    .get('/vehicles/' + v.id)
    .expect(200);
  expect(fleet.body.status).toBe('ACTIVE');
  const released = await api()
    .get(`/vehicles/${v.id}/rental-state`)
    .expect(200);
  expect(released.body.state).toBe('AVAILABLE');
  const audit = await database!.pool.query<{
    action: string;
    metadata: Record<string, unknown>;
  }>(
    'select action,metadata from public.audit_logs where business_id=$1 and entity_id=$2',
    [demo.businessA, r.id],
  );
  expect(audit.rows.map((a) => a.action)).toEqual(
    expect.arrayContaining([
      'rental.create',
      'rental.update',
      'rental.reserve',
      'rental.handover',
      'rental.extend',
      'rental.return',
    ]),
  );
  expect(audit.rows.every((a) => a.metadata.requestId)).toBe(true);
  expect(JSON.stringify(audit.rows)).not.toContain('Private synthetic note');
  expect(JSON.stringify(audit.rows)).not.toContain(c.phone);
}, 60000);

it('prevents concurrent reservations and preserves half-open adjacency and cancellation release', async () => {
  const v = await vehicle();
  const c = await customer();
  const start = iso(300),
    end = iso(360);
  const first = await rental(v.id, c.id, { startAt: start, endAt: end });
  const second = await rental(v.id, c.id, { startAt: start, endAt: end });
  const before = await api().get(availability(start, end)).expect(200);
  expect(
    before.body.data.find((x: { id: string }) => x.id === v.id).available,
  ).toBe(true);
  const race = await Promise.all([
    api().post(action(first.id, 'reserve')),
    api().post(action(second.id, 'reserve')),
  ]);
  expect(race.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
  const winner = race.find((r) => r.status === 201)!.body as { id: string };
  const blocked = await api().get(availability(start, end)).expect(200);
  expect(
    blocked.body.data.find((x: { id: string }) => x.id === v.id),
  ).toMatchObject({ available: false, reason: 'RESERVED' });
  const next = await rental(v.id, c.id, { startAt: end, endAt: iso(420) });
  await api().post(action(next.id, 'reserve')).expect(201);
  const summary = await api().get(`/vehicles/${v.id}/rental-state`).expect(200);
  expect(summary.body.nextRental.id).toBe(winner.id);
  await api()
    .post(action(winner.id, 'cancel'))
    .send({ notes: 'Synthetic cancellation' })
    .expect(201);
  const available = await api().get(availability(start, end)).expect(200);
  expect(
    available.body.data.find((x: { id: string }) => x.id === v.id).available,
  ).toBe(true);
  await api().post(action(winner.id, 'reserve')).expect(409);
  const stored = await database!.pool.query<{ status: string }>(
    'select status from public.rentals where business_id=$1 and vehicle_id=$2',
    [demo.businessA, v.id],
  );
  expect(stored.rows.filter((x) => x.status === 'RESERVED')).toHaveLength(1);
}, 60000);

it('rejects extension overlap, inactive resources, premature handover and invalid transitions without audit changes', async () => {
  const v = await vehicle(),
    c = await customer();
  const boundary = iso(120);
  const a = await rental(v.id, c.id, { startAt: iso(1), endAt: boundary });
  const b = await rental(v.id, c.id, { startAt: boundary, endAt: iso(180) });
  await api().post(action(a.id, 'reserve')).expect(201);
  await api().post(action(b.id, 'reserve')).expect(201);
  await api()
    .post(action(a.id, 'handover'))
    .send({ odometerStart: 100 })
    .expect(409);
  const auditBefore = await database!.pool.query<{ n: number }>(
    'select count(*)::int as n from public.audit_logs where business_id=$1 and entity_id=$2',
    [demo.businessA, a.id],
  );
  await api()
    .post(action(a.id, 'extend'))
    .send({ endAt: iso(150) })
    .expect(409);
  const auditAfter = await database!.pool.query<{ n: number }>(
    'select count(*)::int as n from public.audit_logs where business_id=$1 and entity_id=$2',
    [demo.businessA, a.id],
  );
  expect(auditAfter.rows).toEqual(auditBefore.rows);
  expect(
    (
      await api()
        .get('/rentals/' + a.id)
        .expect(200)
    ).body.endAt,
  ).toBe(boundary);
  const inactiveV = await vehicle();
  await api()
    .patch('/vehicles/' + inactiveV.id)
    .send({ status: 'INACTIVE' })
    .expect(200);
  const inactiveC = await customer();
  await api()
    .patch('/customers/' + inactiveC.id)
    .send({ status: 'INACTIVE' })
    .expect(200);
  // Whether rejection occurs at draft creation or reserve, an inactive resource cannot reserve.
  for (const [vid, cid] of [
    [inactiveV.id, c.id],
    [v.id, inactiveC.id],
  ]) {
    const draft = await api()
      .post('/rentals')
      .send({
        vehicleId: vid,
        customerId: cid,
        startAt: iso(600),
        endAt: iso(660),
      });
    if (draft.status === 201) {
      await api().post(action(draft.body.id, 'reserve')).expect(409);
    } else expect(draft.status).toBe(409);
  }
  const inactiveAvailability = await api()
    .get(availability(iso(600), iso(660)))
    .expect(200);
  expect(
    inactiveAvailability.body.data.find(
      (x: { id: string }) => x.id === inactiveV.id,
    ),
  ).toMatchObject({ available: false, reason: 'INACTIVE' });
  const draft = await rental((await vehicle()).id, c.id);
  await api()
    .post(action(draft.id, 'return'))
    .send({ odometerEnd: 10 })
    .expect(409);
  await api().post(action(draft.id, 'cancel')).expect(201);
  await api().post(action(draft.id, 'cancel')).expect(409);
}, 60000);

it('derives overdue from the database clock and blocks overdue occupancy until actual return', async () => {
  const v = await vehicle(),
    c = await customer();
  const r = await rental(v.id, c.id);
  // Simulate elapsed time on this suite-owned record only, avoiding sleeps or production clock overrides.
  await database!.pool.query(
    "update public.rentals set start_at=clock_timestamp()-interval '3 hours',end_at=clock_timestamp()-interval '1 hour',status='ACTIVE',reserved_at=clock_timestamp()-interval '3 hours',handed_over_at=clock_timestamp()-interval '2 hours',odometer_start=20 where business_id=$1 and id=$2",
    [demo.businessA, r.id],
  );
  const detail = await api()
    .get('/rentals/' + r.id)
    .expect(200);
  expect(detail.body.status).toBe('ACTIVE');
  expect(detail.body.isOverdue).toBe(true);
  const state = await api().get(`/vehicles/${v.id}/rental-state`).expect(200);
  expect(state.body.state).toBe('OVERDUE');
  const available = await api()
    .get(availability(iso(10), iso(30)))
    .expect(200);
  expect(
    available.body.data.find((x: { id: string }) => x.id === v.id),
  ).toMatchObject({ available: false, reason: 'OVERDUE' });
  const contender = await rental(v.id, c.id, {
    startAt: iso(10),
    endAt: iso(30),
  });
  await api().post(action(contender.id, 'reserve')).expect(409);
  await api()
    .post(action(r.id, 'return'))
    .send({ odometerEnd: 30 })
    .expect(201);
  const released = await api()
    .get(availability(iso(10), iso(30)))
    .expect(200);
  expect(
    released.body.data.find((x: { id: string }) => x.id === v.id).available,
  ).toBe(true);
  await api().post(action(contender.id, 'reserve')).expect(201);
}, 60000);

it('rejects known cross-tenant Customer/Rental IDs and tenant injection on every lifecycle action', async () => {
  const ca = await customer(),
    va = await vehicle();
  const cb = await customer('ownerB', demo.businessB),
    vb = await vehicle('ownerB', demo.businessB);
  const foreign = await rental(vb.id, cb.id, {}, 'ownerB', demo.businessB);
  for (const path of [
    '/customers/' + cb.id,
    '/rentals/' + foreign.id,
    `/vehicles/${vb.id}/rental-state`,
  ])
    await api().get(path).expect(404);
  await api()
    .patch('/customers/' + cb.id)
    .send({ name: 'Forbidden' })
    .expect(404);
  await api()
    .patch('/rentals/' + foreign.id)
    .send({ notes: 'Forbidden' })
    .expect(404);
  for (const [name, body] of [
    ['reserve', {}],
    ['handover', { odometerStart: 0 }],
    ['extend', { endAt: iso(180) }],
    ['return', { odometerEnd: 10 }],
    ['cancel', {}],
  ] as const)
    await api().post(action(foreign.id, name)).send(body).expect(404);
  for (const [vid, cid] of [
    [vb.id, ca.id],
    [va.id, cb.id],
  ])
    await api()
      .post('/rentals')
      .send({
        vehicleId: vid,
        customerId: cid,
        startAt: iso(1),
        endAt: iso(30),
      })
      .expect(404);
  await api('ownerA', demo.businessB).get('/rentals').expect(403);
  for (const path of [
    '/customers?limit=100',
    '/rentals?limit=100',
    availability(iso(1), iso(30)),
  ]) {
    const list = await api().get(path).expect(200);
    expect(
      list.body.data.every(
        (r: { businessId: string }) => r.businessId === demo.businessA,
      ),
    ).toBe(true);
  }
}, 60000);

it('enforces live Data API tenant RLS and denies anonymous/direct Customer/Rental writes', async () => {
  const c = await customer(),
    v = await vehicle();
  await rental(v.id, c.id);
  const foreign = await customer('ownerB', demo.businessB);
  const config = loadConfig();
  const headers = {
    apikey: config.publishableKey,
    Authorization: 'Bearer ' + tokens.ownerA,
  };
  for (const table of ['customers', 'rentals']) {
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/${table}?select=business_id`,
      { headers },
    );
    expect(response.status).toBe(200);
    const rows = (await response.json()) as { business_id: string }[];
    expect(rows.every((r) => r.business_id === demo.businessA)).toBe(true);
    const write = await fetch(`${config.supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        table === 'customers'
          ? {
              business_id: demo.businessA,
              name: 'Forbidden',
              phone: '0900123456',
            }
          : {
              business_id: demo.businessA,
              customer_id: c.id,
              vehicle_id: v.id,
              start_at: iso(1),
              end_at: iso(30),
            },
      ),
    });
    expect(write.status).toBe(403);
    const anon = await fetch(
      `${config.supabaseUrl}/rest/v1/${table}?select=id`,
      { headers: { apikey: config.publishableKey } },
    );
    expect([401, 403]).toContain(anon.status);
  }
  const hidden = await fetch(
    `${config.supabaseUrl}/rest/v1/customers?id=eq.${foreign.id}&select=id`,
    { headers },
  );
  expect(await hidden.json()).toEqual([]);
});
