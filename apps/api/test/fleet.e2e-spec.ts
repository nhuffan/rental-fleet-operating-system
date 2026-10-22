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
      provider: 'manual',
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

it('requires authentication and grants operations fleet reads but no writes', async () => {
  await request(app!.getHttpServer()).get('/api/v1/vehicles').expect(401);
  const context = await api('operationsA').get('/me').expect(200);
  expect(context.body.permissions).toEqual(
    expect.arrayContaining(['vehicle.read', 'gps.read']),
  );
  expect(context.body.permissions).not.toContain('vehicle.manage');
  await api('operationsA').get('/vehicles').expect(200);
  await api('operationsA').get('/gps-devices').expect(200);
  await api('operationsA')
    .post('/vehicles')
    .send({ licensePlate: plate(), make: 'Test', model: 'Denied' })
    .expect(403);
  await api('operationsA')
    .post('/gps-devices')
    .send({ provider: 'manual', deviceUid: unique() })
    .expect(403);
  const v = await vehicle('adminA');
  const d = await device('adminA');
  await api('operationsA')
    .patch('/vehicles/' + v.id)
    .send({ status: 'INACTIVE' })
    .expect(403);
  await api('operationsA')
    .patch('/gps-devices/' + d.id)
    .send({ label: 'Denied' })
    .expect(403);
  await api('operationsA')
    .post(`/vehicles/${v.id}/device-assignments`)
    .send({ deviceId: d.id })
    .expect(403);
  await api('operationsA')
    .post(`/vehicles/${v.id}/device-assignments/${randomUUID()}/end`)
    .expect(403);
});

it('normalizes tenant-unique plates and provider-owned unique device identities', async () => {
  const canonical = plate();
  const v = await vehicle('ownerA', demo.businessA, {
    licensePlate:
      ' ' +
      canonical.slice(0, 4).toLowerCase() +
      '- ' +
      canonical.slice(4).toLowerCase() +
      ' ',
  });
  expect(v.licensePlate).toBe(canonical);
  const duplicate = await api()
    .post('/vehicles')
    .send({ licensePlate: canonical, make: 'Test', model: 'Duplicate' })
    .expect(409);
  expect(duplicate.body.code).toBe('PLATE_EXISTS');
  await vehicle('ownerB', demo.businessB, { licensePlate: canonical });
  const uid = 'stage3-' + unique();
  const d = await device('ownerA', demo.businessA, {
    provider: ' Manual ',
    deviceUid: ' ' + uid + ' ',
  });
  expect(d.provider).toBe('manual');
  expect(d.deviceUid).toBe(uid);
  for (const [actor, business] of [
    ['ownerA', demo.businessA],
    ['ownerB', demo.businessB],
  ]) {
    const r = await api(actor, business)
      .post('/gps-devices')
      .send({ provider: 'MANUAL', deviceUid: uid })
      .expect(409);
    expect(r.body.code).toBe('DEVICE_UID_EXISTS');
    expect(JSON.stringify(r.body)).not.toContain(d.id);
  }
  await device('ownerB', demo.businessB, {
    provider: 'other-provider',
    deviceUid: uid,
  });
  await api()
    .patch('/gps-devices/' + d.id)
    .send({ provider: 'another' })
    .expect(400);
  await api()
    .patch('/gps-devices/' + d.id)
    .send({ deviceUid: unique() })
    .expect(400);
});

it('rejects invalid payloads, rental states, pagination and foreign branches', async () => {
  await api()
    .post('/vehicles')
    .send({ licensePlate: '---', make: 'Test', model: 'Invalid' })
    .expect(400);
  await api()
    .post('/vehicles')
    .send({
      licensePlate: plate(),
      make: 'Test',
      model: 'Invalid',
      status: 'RENTED',
    })
    .expect(400);
  await api()
    .post('/vehicles')
    .send({
      licensePlate: plate(),
      make: 'Test',
      model: 'Injected',
      businessId: demo.businessB,
    })
    .expect(400);
  const foreign = await api()
    .post('/vehicles')
    .send({
      licensePlate: plate(),
      make: 'Test',
      model: 'Foreign',
      branchId: demo.branchB,
    })
    .expect(400);
  expect(foreign.body.code).toBe('INVALID_BRANCH');
  const missing = await api()
    .post('/vehicles')
    .send({
      licensePlate: plate(),
      make: 'Test',
      model: 'Missing branch',
      branchId: randomUUID(),
    })
    .expect(400);
  expect(missing.body.code).toBe('INVALID_BRANCH');
  await api().get('/vehicles?page=0').expect(400);
  await api().get('/vehicles?sort=businessId').expect(400);
  await api().get('/vehicles?branchId=not-a-uuid').expect(400);
  await api().get('/gps-devices?available=not-a-boolean').expect(400);
  await api()
    .post('/gps-devices')
    .send({ provider: 'bad/provider', deviceUid: 'test' })
    .expect(400);
  await api()
    .post('/gps-devices')
    .send({ provider: 'manual', deviceUid: 'bad uid' })
    .expect(400);
});

it('isolates known vehicle, device and assignment IDs across businesses', async () => {
  const a = await vehicle('ownerA', demo.businessA, { branchId: demo.branchA });
  const b = await vehicle('ownerB', demo.businessB, { branchId: demo.branchB });
  const foreignDevice = await device('ownerB', demo.businessB);
  await api()
    .get('/vehicles/' + b.id)
    .expect(404);
  await api()
    .patch('/vehicles/' + b.id)
    .send({ model: 'Forbidden' })
    .expect(404);
  await api().get(`/vehicles/${b.id}/device-assignments`).expect(404);
  await api()
    .patch('/gps-devices/' + foreignDevice.id)
    .send({ label: 'Forbidden' })
    .expect(404);
  await api()
    .post(`/vehicles/${a.id}/device-assignments`)
    .send({ deviceId: foreignDevice.id })
    .expect(404);
  await api()
    .post(`/vehicles/${b.id}/device-assignments`)
    .send({ deviceId: foreignDevice.id })
    .expect(404);
  await api()
    .patch('/vehicles/' + a.id)
    .send({ branchId: demo.branchB })
    .expect(400);
  await api('ownerA', demo.businessB).get('/vehicles').expect(403);
  const rows = await api().get('/vehicles?limit=100').expect(200);
  expect(
    rows.body.data.every(
      (v: { businessId: string }) => v.businessId === demo.businessA,
    ),
  ).toBe(true);
  const devices = await api().get('/gps-devices?limit=100').expect(200);
  expect(
    devices.body.data.every(
      (d: { businessId: string }) => d.businessId === demo.businessA,
    ),
  ).toBe(true);
  const assigned = await api('ownerB', demo.businessB)
    .post(`/vehicles/${b.id}/device-assignments`)
    .send({ deviceId: foreignDevice.id })
    .expect(201);
  await api()
    .post(`/vehicles/${a.id}/device-assignments/${assigned.body.id}/end`)
    .expect(404);
});

it('supports create -> assign -> end -> reassign while preserving history and audit', async () => {
  const v = await vehicle('adminA', demo.businessA, { branchId: demo.branchA });
  const first = await device('adminA');
  const second = await device('adminA');
  const assigned = await api('adminA')
    .post(`/vehicles/${v.id}/device-assignments`)
    .send({ deviceId: first.id })
    .expect(201);
  expect(assigned.body.unassignedAt).toBeNull();
  expect(assigned.body.device.id).toBe(first.id);
  const current = await api()
    .get('/vehicles/' + v.id)
    .expect(200);
  expect(current.body.currentAssignment.id).toBe(assigned.body.id);
  for (const path of ['/vehicles/' + v.id, '/gps-devices/' + first.id]) {
    const disabled = await api()
      .patch(path)
      .send({ status: 'INACTIVE' })
      .expect(409);
    expect(disabled.body.code).toBe('RESOURCE_HAS_ASSIGNMENT');
  }
  const ended = await api('adminA')
    .post(`/vehicles/${v.id}/device-assignments/${assigned.body.id}/end`)
    .expect(201);
  expect(ended.body.unassignedAt).toBeTruthy();
  const doubleEnd = await api()
    .post(`/vehicles/${v.id}/device-assignments/${assigned.body.id}/end`)
    .expect(409);
  expect(doubleEnd.body.code).toBe('ASSIGNMENT_ENDED');
  await api()
    .patch('/vehicles/' + v.id)
    .send({ status: 'INACTIVE' })
    .expect(200);
  const inactiveVehicle = await api()
    .post(`/vehicles/${v.id}/device-assignments`)
    .send({ deviceId: second.id })
    .expect(409);
  expect(inactiveVehicle.body.code).toBe('VEHICLE_INACTIVE');
  await api()
    .patch('/vehicles/' + v.id)
    .send({ status: 'ACTIVE' })
    .expect(200);
  await api()
    .patch('/gps-devices/' + second.id)
    .send({ status: 'INACTIVE' })
    .expect(200);
  const inactiveDevice = await api()
    .post(`/vehicles/${v.id}/device-assignments`)
    .send({ deviceId: second.id })
    .expect(409);
  expect(inactiveDevice.body.code).toBe('DEVICE_INACTIVE');
  await api()
    .patch('/gps-devices/' + second.id)
    .send({ status: 'ACTIVE' })
    .expect(200);
  const reassigned = await api('adminA')
    .post(`/vehicles/${v.id}/device-assignments`)
    .send({ deviceId: second.id })
    .expect(201);
  const history = await api()
    .get(`/vehicles/${v.id}/device-assignments?limit=1&page=1`)
    .expect(200);
  expect(history.body.total).toBe(2);
  expect(history.body.data).toHaveLength(1);
  expect(history.body.data[0].id).toBe(reassigned.body.id);
  const older = await api()
    .get(`/vehicles/${v.id}/device-assignments?limit=1&page=2`)
    .expect(200);
  expect(older.body.data[0].id).toBe(assigned.body.id);
  expect(older.body.data[0].unassignedAt).toBe(ended.body.unassignedAt);
  const available = await api()
    .get('/gps-devices?available=true&limit=100')
    .expect(200);
  expect(
    available.body.data.some((d: { id: string }) => d.id === second.id),
  ).toBe(false);
  expect(
    available.body.data.some((d: { id: string }) => d.id === first.id),
  ).toBe(true);
  const audit = await database!.pool.query<{
    action: string;
    metadata: { requestId?: string; fields?: string[] };
  }>(
    'select action,metadata from public.audit_logs where business_id=$1 and entity_id=any($2::uuid[])',
    [
      demo.businessA,
      [v.id, first.id, second.id, assigned.body.id, reassigned.body.id],
    ],
  );
  expect(audit.rows.map((r) => r.action)).toEqual(
    expect.arrayContaining([
      'vehicle.create',
      'vehicle.update',
      'gps_device.create',
      'gps_device.update',
      'device_assignment.assign',
      'device_assignment.end',
    ]),
  );
  expect(audit.rows.every((r) => r.metadata.requestId)).toBe(true);
}, 30000);

it('serializes simultaneous assignment attempts for both vehicle and device uniqueness', async () => {
  const one = await vehicle();
  const two = await vehicle();
  const d1 = await device();
  const d2 = await device();
  const vehicleRace = await Promise.all([
    api()
      .post(`/vehicles/${one.id}/device-assignments`)
      .send({ deviceId: d1.id }),
    api()
      .post(`/vehicles/${one.id}/device-assignments`)
      .send({ deviceId: d2.id }),
  ]);
  expect(vehicleRace.map((r) => r.status).sort((a, b) => a - b)).toEqual([
    201, 409,
  ]);
  const winning = vehicleRace.find((r) => r.status === 201)!;
  const competing = await api()
    .post(`/vehicles/${two.id}/device-assignments`)
    .send({ deviceId: winning.body.deviceId })
    .expect(409);
  expect(competing.body.code).toBe('DEVICE_ASSIGNED');
  const v3 = await vehicle();
  const v4 = await vehicle();
  const shared = await device();
  const deviceRace = await Promise.all([
    api()
      .post(`/vehicles/${v3.id}/device-assignments`)
      .send({ deviceId: shared.id }),
    api()
      .post(`/vehicles/${v4.id}/device-assignments`)
      .send({ deviceId: shared.id }),
  ]);
  expect(deviceRace.map((r) => r.status).sort((a, b) => a - b)).toEqual([
    201, 409,
  ]);
  const active = await database!.pool.query<{ total: number }>(
    'select count(*)::int as total from public.device_assignments where business_id=$1 and device_id=$2 and unassigned_at is null',
    [demo.businessA, shared.id],
  );
  expect(active.rows[0].total).toBe(1);
}, 30000);

it('applies membership RLS to fleet tables and forbids direct Data API writes', async () => {
  const a = await vehicle();
  const b = await vehicle('ownerB', demo.businessB);
  const d = await device();
  const c = loadConfig();
  const headers = {
    apikey: c.publishableKey,
    Authorization: 'Bearer ' + tokens.ownerA,
  };
  for (const table of ['vehicles', 'gps_devices', 'device_assignments']) {
    const r = await fetch(
      `${c.supabaseUrl}/rest/v1/${table}?select=business_id`,
      { headers },
    );
    expect(r.status).toBe(200);
    const rows = (await r.json()) as { business_id: string }[];
    expect(rows.every((row) => row.business_id === demo.businessA)).toBe(true);
  }
  const hidden = await fetch(
    `${c.supabaseUrl}/rest/v1/vehicles?id=eq.${b.id}&select=id`,
    { headers },
  );
  expect(await hidden.json()).toEqual([]);
  const write = await fetch(`${c.supabaseUrl}/rest/v1/vehicles`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_id: demo.businessA,
      license_plate: plate(),
      make: 'Forbidden',
      model: 'Direct write',
    }),
  });
  expect(write.status).toBe(403);
  const edit = await fetch(
    `${c.supabaseUrl}/rest/v1/gps_devices?id=eq.${d.id}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Forbidden direct write' }),
    },
  );
  expect(edit.status).toBe(403);
  const anonymous = await fetch(`${c.supabaseUrl}/rest/v1/vehicles?select=id`, {
    headers: { apikey: c.publishableKey },
  });
  expect([401, 403]).toContain(anonymous.status);
  const detail = await api()
    .get('/vehicles/' + a.id)
    .expect(200);
  expect(detail.body.currentAssignment).toBeNull();
}, 30000);
