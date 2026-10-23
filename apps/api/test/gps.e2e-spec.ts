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
  branchA: string;
  branchB: string;
  accounts: Record<string, { id: string; email: string; password: string }>;
};
const demo = JSON.parse(readFileSync('../../.env.demo.json', 'utf8')) as Demo;
const tokens: Record<string, string> = {};
const vehicleIds: string[] = [];
const deviceIds: string[] = [];
let app: INestApplication | undefined;
let database: Database | undefined;
const unique = () => randomUUID().replaceAll('-', '');
const plate = () => 'T' + unique().slice(0, 14).toUpperCase();
function api(actor = 'ownerA', business = demo.businessA) {
  if (!app) throw new Error('Test app is not ready');
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
async function vehicle(
  actor = 'ownerA',
  business = demo.businessA,
  extra: Record<string, unknown> = {},
) {
  const r = await api(actor, business)
    .post('/vehicles')
    .send({
      licensePlate: plate(),
      make: 'Test Make',
      model: 'Stage 3 E2E',
      ...extra,
    })
    .expect(201);
  vehicleIds.push(r.body.id as string);
  return r.body as {
    id: string;
    businessId: string;
    licensePlate: string;
    status: string;
    currentAssignment: { id: string } | null;
  };
}
async function device(
  actor = 'ownerA',
  business = demo.businessA,
  extra: Record<string, unknown> = {},
) {
  const r = await api(actor, business)
    .post('/gps-devices')
    .send({
      provider: 'traccar',
      deviceUid: 'stage3-' + unique(),
      label: 'Disposable Stage 3 E2E',
      ...extra,
    })
    .expect(201);
  deviceIds.push(r.body.id as string);
  return r.body as {
    id: string;
    businessId: string;
    provider: string;
    deviceUid: string;
    status: string;
  };
}
beforeAll(async () => {
  process.env.LOG_REQUESTS = 'false';
  const c = loadConfig();
  process.env.GPS_TRACCAR_TOKEN = 'stage5-e2e-' + randomUUID() + randomUUID();
  const expected = 'eeryymswcufnebibigqf';
  if (
    c.environment !== 'development' ||
    new URL(c.supabaseUrl).hostname !== expected + '.supabase.co' ||
    demo.projectRef !== expected
  )
    throw new Error(
      'Fleet E2E is restricted to the seeded development project',
    );
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
      await database.pool.query(
        'delete from public.gps_positions where business_id=any($1::uuid[]) and vehicle_id=any($2::uuid[])',
        [[demo.businessA, demo.businessB], vehicleIds],
      );
      // Only records created by this suite are removed; audit evidence is retained.
      await database.pool.query(
        'delete from public.device_assignments where business_id=any($1::uuid[]) and (vehicle_id=any($2::uuid[]) or device_id=any($3::uuid[]))',
        [[demo.businessA, demo.businessB], vehicleIds, deviceIds],
      );
      await database.pool.query(
        'delete from public.vehicles where business_id=any($1::uuid[]) and id=any($2::uuid[])',
        [[demo.businessA, demo.businessB], vehicleIds],
      );
      await database.pool.query(
        'delete from public.gps_devices where business_id=any($1::uuid[]) and id=any($2::uuid[])',
        [[demo.businessA, demo.businessB], deviceIds],
      );
    }
  } finally {
    await app?.close();
  }
}, 30000);

function packet(
  uid: string,
  time = new Date(),
  extra: Record<string, unknown> = {},
) {
  return {
    device: { uniqueId: uid },
    position: {
      id: 1,
      valid: true,
      fixTime: time.toISOString(),
      latitude: 10.77,
      longitude: 106.7,
      speed: 10,
      course: 90,
      attributes: { ignition: true },
      ...extra,
    },
  };
}
function ingest(body: object, token = process.env.GPS_TRACCAR_TOKEN) {
  return request(app!.getHttpServer())
    .post('/api/v1/integrations/traccar/positions')
    .set('X-Traccar-Token', token ?? '')
    .send(body);
}
async function assigned() {
  const v = await vehicle();
  const d = await device();
  const a = await api()
    .post('/vehicles/' + v.id + '/device-assignments')
    .send({ deviceId: d.id })
    .expect(201);
  await database!.pool.query(
    "update public.device_assignments set assigned_at=clock_timestamp()-interval '1 hour' where business_id=$1 and id=$2",
    [demo.businessA, a.body.id],
  );
  return { v, d, a: a.body as { id: string } };
}
it('requires trusted secret, validates packets and fails unknown/unassigned resolution', async () => {
  await ingest({}, 'wrong').expect(401);
  await ingest({}).expect(400);
  await ingest(packet('UNKNOWN-' + unique())).expect(409);
  const d = await device();
  await ingest(packet(d.deviceUid)).expect(409);
  await request(app!.getHttpServer())
    .get('/api/v1/fleet/locations')
    .expect(401);
}, 30000);
it('stores canonical telemetry, deduplicates, keeps current monotonic, scopes reads and denies Data API', async () => {
  const { v, d } = await assigned();
  let location = await api()
    .get('/vehicles/' + v.id + '/location')
    .expect(200);
  expect(location.body.state).toBe('NO_DATA');
  expect(location.body.location).toBeNull();
  const time = new Date();
  const body = packet(d.deviceUid, time);
  const first = await ingest(body).expect(201);
  expect(first.body.duplicate).toBe(false);
  const duplicate = await ingest({
    ...body,
    position: { ...body.position, id: 99 },
  }).expect(201);
  expect(duplicate.body).toEqual({ ...first.body, duplicate: true });
  await ingest(
    packet(d.deviceUid, new Date(time.getTime() - 300000), { latitude: 11 }),
  ).expect(201);
  location = await api()
    .get('/vehicles/' + v.id + '/location')
    .expect(200);
  expect(location.body.state).toBe('FRESH');
  expect(location.body.location.latitude).toBe(10.77);
  expect(location.body.location.speedKph).toBe(18.52);
  expect(location.body.location.sourceMode).toBe('TEST');
  expect(new Date(location.body.lastSeenAt).getTime()).toBe(time.getTime());
  const history = await database!.pool.query(
    'select count(*)::int as n from public.gps_positions where business_id=$1 and device_id=$2',
    [demo.businessA, d.id],
  );
  expect(history.rows[0].n).toBe(2);
  await ingest(packet(d.deviceUid, time, { latitude: 12, course: 180 })).expect(
    201,
  );
  const equal = await api()
    .get('/vehicles/' + v.id + '/location')
    .expect(200);
  expect(equal.body.location.latitude).toBe(10.77);
  expect(equal.body.location.heading).toBe(90);
  await api('ownerB', demo.businessB)
    .get('/vehicles/' + v.id + '/location')
    .expect(404);
  const other = await api('ownerB', demo.businessB)
    .get('/fleet/locations?limit=100')
    .expect(200);
  expect(
    other.body.data.some((x: { vehicleId: string }) => x.vehicleId === v.id),
  ).toBe(false);
  const page = await api('operationsA')
    .get('/fleet/locations?limit=1&state=FRESH&search=' + v.licensePlate)
    .expect(200);
  expect(page.body.total).toBe(1);
  expect(page.body.data[0].vehicleId).toBe(v.id);
  expect(page.body.data[0]).not.toHaveProperty('deviceUid');
  expect(page.body).not.toHaveProperty('raw');
  await api().get('/fleet/locations?limit=101').expect(400);
  await api().get('/fleet/locations?state=ONLINE').expect(400);
  const c = loadConfig();
  const client = createClient(c.supabaseUrl, c.publishableKey, {
    global: { headers: { Authorization: 'Bearer ' + tokens.ownerA } },
    auth: { persistSession: false },
  });
  const read = await client.from('gps_positions').select('*');
  expect(read.error).not.toBeNull();
  const write = await client
    .from('gps_positions')
    .insert({ business_id: demo.businessA });
  expect(write.error).not.toBeNull();
  await ingest(packet(d.deviceUid, new Date(Date.now() + 600000))).expect(409);
  await ingest(
    packet(d.deviceUid, new Date(Date.now() - 31 * 86400000)),
  ).expect(409);
}, 60000);
it('resolves delayed packets against historical assignment and hides old-device location after reassignment', async () => {
  const { v, d, a } = await assigned();
  const oldTime = new Date(Date.now() - 120000);
  await ingest(packet(d.deviceUid, oldTime)).expect(201);
  await api()
    .post(`/vehicles/${v.id}/device-assignments/${a.id}/end`)
    .send({})
    .expect(201);
  const next = await vehicle();
  await api()
    .post('/vehicles/' + next.id + '/device-assignments')
    .send({ deviceId: d.id })
    .expect(201);
  await ingest(
    packet(d.deviceUid, new Date(oldTime.getTime() + 1000), { latitude: 12 }),
  ).expect(201);
  const old = await api()
    .get('/vehicles/' + v.id + '/location')
    .expect(200);
  expect(old.body.state).toBe('UNASSIGNED');
  expect(old.body.location).toBeNull();
  const empty = await api()
    .get('/vehicles/' + next.id + '/location')
    .expect(200);
  expect(empty.body.state).toBe('NO_DATA');
  await ingest(packet(d.deviceUid)).expect(201);
  const current = await api()
    .get('/vehicles/' + next.id + '/location')
    .expect(200);
  expect(current.body.state).toBe('FRESH');
  const historical = await database!.pool.query(
    'select vehicle_id from public.gps_positions where business_id=$1 and device_id=$2 and latitude=12',
    [demo.businessA, d.id],
  );
  expect(historical.rows[0].vehicle_id).toBe(v.id);
}, 60000);
it('derives stale/offline from fix time even on freshly received packets', async () => {
  const { v, d } = await assigned();
  await ingest(packet(d.deviceUid, new Date(Date.now() - 650000))).expect(201);
  let p = await api()
    .get('/vehicles/' + v.id + '/location')
    .expect(200);
  expect(p.body.state).toBe('OFFLINE');
  await ingest(packet(d.deviceUid, new Date(Date.now() - 180000))).expect(201);
  p = await api()
    .get('/vehicles/' + v.id + '/location')
    .expect(200);
  expect(p.body.state).toBe('STALE');
  const list = await api()
    .get('/fleet/locations?state=STALE&search=' + v.licensePlate)
    .expect(200);
  expect(list.body.total).toBe(1);
}, 60000);
it('serializes concurrent retransmissions without duplicate history', async () => {
  const { d } = await assigned();
  const b = packet(d.deviceUid);
  const responses = await Promise.all([ingest(b), ingest(b), ingest(b)]);
  expect(responses.map((x) => x.status)).toEqual([201, 201, 201]);
  expect(responses.filter((x) => !x.body.duplicate)).toHaveLength(1);
  expect(new Set(responses.map((x) => x.body.positionId)).size).toBe(1);
}, 60000);
