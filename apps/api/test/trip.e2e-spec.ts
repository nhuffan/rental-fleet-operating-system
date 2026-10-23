import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/http.js';
import { Database } from '../dist/database/database.js';
import { loadConfig } from '../dist/config.js';
type Demo = {
  projectRef: string;
  businessA: string;
  businessB: string;
  accounts: Record<string, { id: string; email: string; password: string }>;
};
const demo = JSON.parse(readFileSync('../../.env.demo.json', 'utf8')) as Demo;
const tokens: Record<string, string> = {};
const vehicleIds: string[] = [],
  deviceIds: string[] = [],
  customerIds: string[] = [],
  rentalIds: string[] = [];
let app: INestApplication | undefined, database: Database | undefined;
const unique = () => randomUUID().replaceAll('-', '');
function api(actor = 'ownerA', business = demo.businessA) {
  if (!app) throw new Error('Test app is not ready');
  const headers = {
    Authorization: 'Bearer ' + tokens[actor],
    'X-Business-Id': business,
  };
  return {
    get: (path: string) =>
      request(app!.getHttpServer())
        .get('/api/v1' + path)
        .set(headers),
    post: (path: string) =>
      request(app!.getHttpServer())
        .post('/api/v1' + path)
        .set(headers),
  };
}
beforeAll(async () => {
  process.env.LOG_REQUESTS = 'false';
  const c = loadConfig(),
    expected = 'eeryymswcufnebibigqf';
  if (
    c.environment !== 'development' ||
    new URL(c.supabaseUrl).hostname !== expected + '.supabase.co' ||
    demo.projectRef !== expected
  )
    throw new Error('Trip E2E is restricted to the seeded development project');
  process.env.GPS_TRACCAR_TOKEN = 'stage6-e2e-' + randomUUID() + randomUUID();
  for (const actor of ['ownerA', 'ownerB', 'adminA', 'operationsA']) {
    const client = createClient(c.supabaseUrl, c.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: demo.accounts[actor].email,
      password: demo.accounts[actor].password,
    });
    if (error || !data.session)
      throw new Error('Development fixture login failed: ' + actor);
    tokens[actor] = data.session.access_token;
  }
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  database = app.get(Database);
}, 60000);
afterAll(async () => {
  try {
    if (database) {
      const scope = [[demo.businessA, demo.businessB], vehicleIds];
      await database.pool.query(
        'delete from public.gps_positions where business_id=any($1::uuid[]) and vehicle_id=any($2::uuid[])',
        scope,
      );
      await database.pool.query(
        'delete from public.rentals where business_id=any($1::uuid[]) and id=any($2::uuid[])',
        [[demo.businessA, demo.businessB], rentalIds],
      );
      await database.pool.query(
        'delete from public.device_assignments where business_id=any($1::uuid[]) and vehicle_id=any($2::uuid[])',
        scope,
      );
      await database.pool.query(
        'delete from public.vehicles where business_id=any($1::uuid[]) and id=any($2::uuid[])',
        scope,
      );
      await database.pool.query(
        'delete from public.gps_devices where business_id=any($1::uuid[]) and id=any($2::uuid[])',
        [[demo.businessA, demo.businessB], deviceIds],
      );
      await database.pool.query(
        'delete from public.customers where business_id=any($1::uuid[]) and id=any($2::uuid[])',
        [[demo.businessA, demo.businessB], customerIds],
      );
    }
  } finally {
    await app?.close();
  }
}, 30000);
async function assigned() {
  const v = await api()
    .post('/vehicles')
    .send({
      licensePlate: 'T6' + unique().slice(0, 12).toUpperCase(),
      make: 'TEST',
      model: 'Trip E2E',
    })
    .expect(201);
  vehicleIds.push(v.body.id as string);
  const d = await api()
    .post('/gps-devices')
    .send({
      provider: 'traccar',
      deviceUid: 'stage6-' + unique(),
      label: 'Disposable Stage 6 Trip E2E',
    })
    .expect(201);
  deviceIds.push(d.body.id as string);
  const a = await api()
    .post('/vehicles/' + String(v.body.id) + '/device-assignments')
    .send({ deviceId: d.body.id })
    .expect(201);
  await database!.pool.query(
    "update public.device_assignments set assigned_at=clock_timestamp()-interval '1 hour' where business_id=$1 and id=$2",
    [demo.businessA, a.body.id],
  );
  return {
    vehicleId: v.body.id as string,
    deviceId: d.body.id as string,
    uid: d.body.deviceUid as string,
    assignmentId: a.body.id as string,
  };
}
function packet(uid: string, time: Date, index: number, stopped = false) {
  return {
    device: { uniqueId: uid },
    position: {
      valid: true,
      fixTime: time.toISOString(),
      latitude: 10.77,
      longitude: 106.7 + index * 0.0005,
      speed: stopped ? 0 : 10,
      course: 90,
      attributes: { ignition: !stopped },
    },
  };
}
function ingest(body: object) {
  return request(app!.getHttpServer())
    .post('/api/v1/integrations/traccar/positions')
    .set('X-Traccar-Token', process.env.GPS_TRACCAR_TOKEN!)
    .send(body);
}
const qs = (from: Date, to: Date) =>
  '&from=' +
  encodeURIComponent(from.toISOString()) +
  '&to=' +
  encodeURIComponent(to.toISOString());
it('reads canonical TEST feed as live derived trips with bounded route replay, rental overlap and all read roles', async () => {
  const fixture = await assigned();
  const start = new Date(Date.now() - 5 * 60000),
    end = new Date();
  const path =
    '/trips?vehicleId=' +
    fixture.vehicleId +
    qs(new Date(start.getTime() - 60000), end);
  expect((await api().get(path).expect(200)).body.data).toEqual([]);
  const packets = Array.from({ length: 6 }, (_, i) =>
    packet(
      fixture.uid,
      new Date(start.getTime() + i * 30000),
      i,
      i === 0 || i === 5,
    ),
  );
  // Deliberately deliver out of order and retransmit: derivation is based on recorded time.
  for (const i of [4, 0, 5, 2, 1, 3, 2]) await ingest(packets[i]).expect(201);
  const c = await api()
    .post('/customers')
    .send({ name: 'Disposable Stage 6 customer', email: 'trip@example.test' })
    .expect(201);
  customerIds.push(c.body.id as string);
  const r = await api()
    .post('/rentals')
    .send({
      vehicleId: fixture.vehicleId,
      customerId: c.body.id,
      startAt: new Date(start.getTime() - 60000).toISOString(),
      endAt: new Date(Date.now() + 3600000).toISOString(),
    })
    .expect(201);
  rentalIds.push(r.body.id as string);
  await api()
    .post('/rentals/' + String(r.body.id) + '/reserve')
    .send({})
    .expect(201);
  const list = await api()
    .get(path + '&sort=asc')
    .expect(200);
  expect(list.body.total).toBe(1);
  const trip = list.body.data[0] as {
    id: string;
    vehicleId: string;
    rentalId: string;
    sourceMode: string;
    partial: boolean;
    pointCount: number;
    distanceMeters: number;
  };
  expect(trip).toMatchObject({
    vehicleId: fixture.vehicleId,
    rentalId: r.body.id,
    sourceMode: 'TEST',
    derivation: 'DERIVED',
    distanceKind: 'ESTIMATED',
    partial: false,
    pointCount: 5,
    routeAvailable: true,
  });
  expect(trip.distanceMeters).toBeGreaterThan(100);
  for (const actor of ['ownerA', 'adminA', 'operationsA']) {
    const me = await api(actor).get('/me').expect(200);
    expect(me.body.permissions).toContain('trip.read');
    await api(actor)
      .get('/trips/' + trip.id)
      .expect(200);
  }
  const route = await api()
    .get('/trips/' + trip.id + '/route?limit=2')
    .expect(200);
  expect(route.body).toMatchObject({
    total: 5,
    hasMore: true,
    page: 1,
    limit: 2,
  });
  expect(
    route.body.data.map((p: { sourceMode: string }) => p.sourceMode),
  ).toEqual(['TEST', 'TEST']);
  expect(route.body.data[0]).not.toHaveProperty('businessId');
  expect(route.body.data[0]).not.toHaveProperty('deviceUid');
  const page2 = await api()
    .get('/trips/' + trip.id + '/route?limit=2&page=2')
    .expect(200);
  expect(page2.body.data[0].id).not.toBe(route.body.data[0].id);
  const rentalPath =
    '/trips?rentalId=' +
    String(r.body.id) +
    qs(new Date(start.getTime() - 60000), end);
  expect(
    (await api().get(rentalPath).expect(200)).body.data[0].rentalAssociations,
  ).toEqual([
    { rentalId: r.body.id, relation: 'CONTAINED', basis: 'SCHEDULED_WINDOW' },
  ]);
  await database!.pool.query(
    'update public.rentals set start_at=$3 where business_id=$1 and id=$2',
    [demo.businessA, r.body.id, new Date(start.getTime() + 60000)],
  );
  const overlap = (await api().get(rentalPath).expect(200)).body.data[0];
  expect(overlap.rentalId).toBeNull();
  expect(overlap.rentalAssociations[0].relation).toBe('OVERLAP');
  const current = await api()
    .get('/vehicles/' + fixture.vehicleId + '/location')
    .expect(200);
  expect(current.body.location.longitude).toBeCloseTo(106.7025);
}, 60000);
it('denies cross-tenant trip IDs, vehicle/rental filters, malformed ranges and unbounded route queries', async () => {
  const f = await assigned(),
    now = new Date(),
    from = new Date(now.getTime() - 60000);
  await ingest(packet(f.uid, from, 0)).expect(201);
  await ingest(packet(f.uid, new Date(now.getTime() - 30000), 1)).expect(201);
  const path =
    '/trips?vehicleId=' +
    f.vehicleId +
    qs(new Date(now.getTime() - 120000), now);
  const trip = (await api().get(path).expect(200)).body.data[0] as {
    id: string;
  };
  await request(app!.getHttpServer()).get('/api/v1/trips').expect(401);
  await api('ownerB', demo.businessB).get(path).expect(404);
  await api('ownerB', demo.businessB)
    .get('/trips/' + trip.id)
    .expect(404);
  await api('ownerB', demo.businessB)
    .get('/trips/' + trip.id + '/route')
    .expect(404);
  const other = await api('ownerB', demo.businessB)
    .get('/trips' + '?' + qs(new Date(now.getTime() - 120000), now).slice(1))
    .expect(200);
  expect(
    other.body.data.some(
      (t: { vehicleId: string }) => t.vehicleId === f.vehicleId,
    ),
  ).toBe(false);
  if (rentalIds[0])
    await api('ownerB', demo.businessB)
      .get('/trips?rentalId=' + rentalIds[0])
      .expect(404);
  await api()
    .get('/trips?from=2026-01-01T00%3A00%3A00Z&to=2026-02-01T00%3A00%3A00Z')
    .expect(400);
  await api().get('/trips?from=2026-01-01').expect(400);
  await api().get('/trips?limit=101').expect(400);
  await api()
    .get('/trips/' + trip.id + '/route?limit=501')
    .expect(400);
  await api().get('/trips/not-an-id').expect(400);
}, 60000);
it('enforces the candidate cap on real PostgreSQL and preserves historical assignment bounds', async () => {
  const f = await assigned(),
    base = new Date(Date.now() - 60000);
  await database!.pool.query(
    `insert into public.gps_positions (business_id,assignment_id,device_id,vehicle_id,provider,device_uid,event_key,recorded_at,latitude,longitude,speed_kph,heading,ignition)
    select $1,$2,$3,$4,'traccar',$5,repeat(md5(n::text),2),$6::timestamptz+n*interval '1 millisecond',10.77,106.7,20,90,true from generate_series(0,10000) n`,
    [demo.businessA, f.assignmentId, f.deviceId, f.vehicleId, f.uid, base],
  );
  const path =
    '/trips?vehicleId=' +
    f.vehicleId +
    qs(new Date(base.getTime() - 1000), new Date());
  const cap = await api().get(path).expect(422);
  expect(cap.body.code).toBe('TRIP_POINT_LIMIT');
  // A formerly accepted future fix must cease to qualify after its assignment ends before fixTime.
  await database!.pool.query(
    'update public.device_assignments set unassigned_at=$3 where business_id=$1 and id=$2',
    [demo.businessA, f.assignmentId, new Date(base.getTime() + 1000)],
  );
  const bounded = await api().get(path).expect(200);
  expect(bounded.body.data[0].pointCount).toBe(1000);
}, 60000);

it('keeps half-open window boundaries deterministic and makes late/removed start-fix IDs recoverable through filtered history', async () => {
  const f = await assigned();
  const clock = Date.now(),
    from = new Date(clock - 180000),
    to = new Date(clock - 30000);
  for (const [age, index] of [
    [120000, 0],
    [60000, 1],
    [30000, 2],
  ])
    await ingest(packet(f.uid, new Date(clock - age), index)).expect(201);
  const path = '/trips?vehicleId=' + f.vehicleId + qs(from, to) + '&sort=asc';
  const before = (await api().get(path).expect(200)).body.data[0];
  expect(before.pointCount).toBe(2);
  const route = (
    await api()
      .get('/trips/' + before.id + '/route')
      .expect(200)
  ).body;
  expect(route.data.map((p: { recordedAt: string }) => p.recordedAt)).toEqual([
    new Date(clock - 120000).toISOString(),
    new Date(clock - 60000).toISOString(),
  ]);
  await ingest(packet(f.uid, from, -1)).expect(201);
  const after = (await api().get(path).expect(200)).body.data[0];
  expect(after.pointCount).toBe(3);
  expect(after.startedAt).toBe(from.toISOString());
  expect(after.id).not.toBe(before.id);
  await api()
    .get('/trips/' + before.id)
    .expect(404);
  const startId = JSON.parse(
    Buffer.from(after.id, 'base64url').toString(),
  ).startId;
  // Simulate retention of an exact owned point; never delete tenant data by age/wildcard.
  await database!.pool.query(
    'delete from public.gps_positions where business_id=$1 and vehicle_id=$2 and id=$3',
    [demo.businessA, f.vehicleId, startId],
  );
  await api()
    .get('/trips/' + after.id + '/route')
    .expect(404);
  const recovered = (await api().get(path).expect(200)).body.data[0];
  expect(recovered.id).toBe(before.id);
  expect(recovered.partial).toBe(true);
  expect(recovered.distanceKind).toBe('ESTIMATED');
  expect(recovered.sourceMode).toBe('TEST');
}, 60000);
