import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import type { Database } from '../database/database.js';
import type { TenantContext } from '../auth/guards.js';
import { permissionsFor } from '../auth/permissions.js';
import { AlertsService } from './alerts.service.js';
import { AlertQuery } from './dto.js';
let db: PGlite, service: AlertsService, a: TenantContext, b: TenantContext;
const time = (seconds: number) => new Date(Date.now() + seconds * 1000);
const query = (extra = {}) => Object.assign(new AlertQuery(), extra);
async function actor() {
  const businessId = randomUUID(),
    userId = randomUUID(),
    membershipId = randomUUID();
  await db.query("insert into businesses values($1,'ACTIVE')", [businessId]);
  await db.query("insert into user_profiles values($1,'ACTIVE')", [userId]);
  await db.query(
    "insert into business_memberships values($1,$2,$3,'OWNER','ACTIVE')",
    [membershipId, businessId, userId],
  );
  return {
    businessId,
    userId,
    membershipId,
    role: 'OWNER',
    email: '',
    businessName: 'Fixture',
  };
}
async function vehicle(c = a, status = 'ACTIVE') {
  const id = randomUUID();
  await db.query('insert into vehicles values($1,$2,$3,$4)', [
    id,
    c.businessId,
    'QA' + id.slice(0, 8),
    status,
  ]);
  return id;
}
async function rental(
  c = a,
  extra: { vehicleId?: string; endSeconds?: number; status?: string } = {},
) {
  const id = randomUUID(),
    vehicleId = extra.vehicleId ?? (await vehicle(c));
  await db.query('insert into rentals values($1,$2,$3,$4,$5)', [
    id,
    c.businessId,
    vehicleId,
    time(extra.endSeconds ?? -3600),
    extra.status ?? 'ACTIVE',
  ]);
  return { id, vehicleId };
}
async function assignment(
  c = a,
  extra: {
    vehicleId?: string;
    vehicleStatus?: string;
    deviceStatus?: string;
    assignedSeconds?: number;
    ended?: boolean;
  } = {},
) {
  const id = randomUUID(),
    deviceId = randomUUID(),
    vehicleId = extra.vehicleId ?? (await vehicle(c, extra.vehicleStatus));
  await db.query('insert into gps_devices values($1,$2,$3)', [
    deviceId,
    c.businessId,
    extra.deviceStatus ?? 'ACTIVE',
  ]);
  await db.query('insert into device_assignments values($1,$2,$3,$4,$5,$6)', [
    id,
    c.businessId,
    vehicleId,
    deviceId,
    time(extra.assignedSeconds ?? -86400),
    extra.ended ? time(-60) : null,
  ]);
  return { id, deviceId, vehicleId, businessId: c.businessId };
}
async function position(
  a: Awaited<ReturnType<typeof assignment>>,
  seconds = -900,
  source = 'TEST',
) {
  await db.query('insert into gps_positions values($1,$2,$3,$4,$5,$6,$7,$8)', [
    randomUUID(),
    a.businessId,
    a.vehicleId,
    a.id,
    a.deviceId,
    time(seconds),
    time(-1),
    source,
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  // Execute production SQL in PostgreSQL. Minimal tables intentionally allow
  // corrupt legacy fixtures to prove joins reject mismatched ownership/intervals.
  await db.exec(`create table businesses(id uuid primary key,status text);
  create table user_profiles(user_id uuid primary key,status text);
  create table business_memberships(id uuid primary key,business_id uuid,user_id uuid,role_key text,status text);
  create table vehicles(id uuid primary key,business_id uuid,license_plate text,status text,registration_expires_on date,insurance_expires_on date,next_maintenance_on date);
  create table gps_devices(id uuid primary key,business_id uuid,status text);
  create table device_assignments(id uuid primary key,business_id uuid,vehicle_id uuid,device_id uuid,assigned_at timestamptz,unassigned_at timestamptz);
  create table gps_positions(id uuid primary key,business_id uuid,vehicle_id uuid,assignment_id uuid,device_id uuid,recorded_at timestamptz,received_at timestamptz,source_mode text);
  create table rentals(id uuid primary key,business_id uuid,vehicle_id uuid,end_at timestamptz,status text);`);
  service = new AlertsService({
    pool: { query: (sql: string, params: unknown[]) => db.query(sql, params) },
  } as unknown as Database);
});
beforeEach(async () => {
  await db.exec(
    'truncate businesses,user_profiles,business_memberships,vehicles,gps_devices,device_assignments,gps_positions,rentals',
  );
  a = await actor();
  b = await actor();
});
afterAll(async () => {
  await db?.close();
});
it('derives overdue and next-24-hour returns only from ACTIVE rentals with one database snapshot', async () => {
  const overdue = await rental(a, { endSeconds: -3600 }),
    soon = await rental(a, { endSeconds: 7200 });
  await rental(a, { endSeconds: 90000 });
  for (const status of ['DRAFT', 'RESERVED', 'COMPLETED', 'CANCELLED'])
    await rental(a, { status });
  const page = await service.list(a, query());
  expect(page).toMatchObject({
    total: 2,
    page: 1,
    limit: 20,
    pollAfterSeconds: 60,
    stats: {
      total: 2,
      critical: 1,
      warning: 1,
      rentalOverdue: 1,
      rentalDueSoon: 1,
      gpsStale: 0,
    },
    rules: {
      dueSoonSeconds: 86400,
      gpsStaleAfterSeconds: 120,
      gpsOfflineAfterSeconds: 600,
    },
  });
  expect(page.data.map((r) => [r.kind, r.severity, r.rentalId])).toEqual([
    ['RENTAL_OVERDUE', 'CRITICAL', overdue.id],
    ['RENTAL_DUE_SOON', 'WARNING', soon.id],
  ]);
  expect(page.data[0].ageSeconds).toBeGreaterThanOrEqual(3600);
  expect(page.data[1].ageSeconds).toBe(0);
  expect(Date.parse(page.asOf)).toBeGreaterThan(
    Date.parse(page.data[0].dueAt!),
  );
  expect(
    page.data.every((r) => r.sourceMode === null && r.lastSeenAt === null),
  ).toBe(true);
});
it('uses existing 120/600 thresholds and omits unassigned, NO_DATA and inactive GPS assets', async () => {
  const fresh = await assignment(),
    stale = await assignment(),
    offline = await assignment();
  await position(fresh, -90);
  await position(stale, -180);
  await position(offline, -900);
  await assignment();
  await vehicle();
  for (const options of [
    { deviceStatus: 'INACTIVE' },
    { vehicleStatus: 'INACTIVE' },
    { ended: true },
    { assignedSeconds: 60 },
  ]) {
    const ignored = await assignment(a, options);
    await position(ignored, -900);
  }
  const page = await service.list(a, query());
  expect(page.total).toBe(2);
  expect(page.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        vehicleId: stale.vehicleId,
        kind: 'GPS_STALE',
        severity: 'WARNING',
        gpsState: 'STALE',
        sourceMode: 'TEST',
        rentalId: null,
      }),
      expect.objectContaining({
        vehicleId: offline.vehicleId,
        kind: 'GPS_STALE',
        severity: 'CRITICAL',
        gpsState: 'OFFLINE',
        sourceMode: 'TEST',
      }),
    ]),
  );
  expect(page.stats).toMatchObject({ gpsStale: 2, critical: 1, warning: 1 });
  expect(JSON.stringify(page)).not.toMatch(
    /latitude|longitude|deviceUid|NO_DATA/,
  );
});
it('only uses real past TEST points inside the current assignment and links its ACTIVE rental', async () => {
  const current = await assignment(),
    r = await rental(a, { vehicleId: current.vehicleId, endSeconds: 90000 });
  await position(current, -300);
  await position(current, 60);
  const before = await assignment(a, { assignedSeconds: -600 });
  await position(before, -900);
  const futureOnly = await assignment();
  await position(futureOnly, 60);
  const unsupported = await assignment();
  await position(unsupported, -900, 'LIVE');
  const ended = await assignment(a, { ended: true });
  await position(ended, -900);
  await assignment(a, { vehicleId: ended.vehicleId, assignedSeconds: -30 });
  const page = await service.list(a, query());
  expect(page.data).toEqual([
    expect.objectContaining({
      id: 'GPS_STALE:' + current.id,
      vehicleId: current.vehicleId,
      rentalId: r.id,
      gpsState: 'STALE',
    }),
  ]);
  expect(Date.parse(page.data[0].lastSeenAt!)).toBeLessThan(
    Date.parse(page.asOf),
  );
});
it('keeps tenant rows separate and rejects foreign or conflicting entity filters without leaking existence', async () => {
  const own = await rental(),
    other = await rental(b),
    otherVehicle = await vehicle();
  await position(await assignment(b));
  expect((await service.list(a, query())).data.map((r) => r.rentalId)).toEqual([
    own.id,
  ]);
  expect((await service.list(b, query())).total).toBe(2);
  for (const q of [
    { vehicleId: other.vehicleId },
    { rentalId: other.id },
    { rentalId: own.id, vehicleId: otherVehicle },
    { vehicleId: randomUUID() },
  ])
    await expect(service.list(a, query(q))).rejects.toMatchObject({
      response: { code: 'ALERT_SCOPE_NOT_FOUND' },
    });
  await expect(
    service.list({ ...a, businessId: b.businessId }, query()),
  ).rejects.toMatchObject({ response: { code: 'TENANT_ACCESS_DENIED' } });
});
it('returns a bounded stable page with entity-scoped counts independent of kind/severity filters', async () => {
  const r = await rental(),
    as = await assignment(a, { vehicleId: r.vehicleId });
  await position(as);
  await rental(a, { endSeconds: 7200 });
  const first = await service.list(a, query({ limit: 1 })),
    second = await service.list(a, query({ limit: 1, page: 2 }));
  expect(first.total).toBe(3);
  expect(first.data).toHaveLength(1);
  expect(second.data).toHaveLength(1);
  expect(first.data[0].id).not.toBe(second.data[0].id);
  expect((await service.list(a, query({ limit: 1 }))).data[0].id).toBe(
    first.data[0].id,
  );
  const filtered = await service.list(
    a,
    query({ vehicleId: r.vehicleId, kind: 'GPS_STALE', severity: 'CRITICAL' }),
  );
  expect(filtered).toMatchObject({
    total: 1,
    stats: { total: 2, rentalOverdue: 1, gpsStale: 1, rentalDueSoon: 0 },
  });
  expect(filtered.data[0].kind).toBe('GPS_STALE');
  expect((await service.list(a, query({ rentalId: r.id }))).total).toBe(2);
  expect((await service.list(a, query({ page: 999 }))).data).toEqual([]);
});
it('grants alert.read to Owner only and denies platform, customer and legacy roles before queries', async () => {
  expect(permissionsFor('OWNER')).toContain('alert.read');
  for (const role of [
    'PLATFORM_OPERATOR',
    'CUSTOMER',
    'OPERATIONS',
    'ADMIN',
    'unknown',
  ]) {
    expect(permissionsFor(role)).not.toContain('alert.read');
    await expect(service.list({ ...a, role }, query())).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  }
});
it.each(['business', 'profile', 'membership'])(
  'rechecks active %s for stale Owner contexts in the read snapshot',
  async (kind) => {
    if (kind === 'business')
      await db.query("update businesses set status='DISABLED' where id=$1", [
        a.businessId,
      ]);
    if (kind === 'profile')
      await db.query(
        "update user_profiles set status='DISABLED' where user_id=$1",
        [a.userId],
      );
    if (kind === 'membership')
      await db.query(
        "update business_memberships set status='DISABLED' where id=$1",
        [a.membershipId],
      );
    await expect(service.list(a, query())).rejects.toMatchObject({
      response: { code: 'TENANT_ACCESS_DENIED' },
    });
  },
);
it('derives registration, insurance and maintenance due alerts in Vietnam days for active vehicles only', async () => {
  const day = (offset: number) =>
    new Date(Date.now() + 7 * 3600_000 + offset * 86400_000)
      .toISOString()
      .slice(0, 10);
  const add = async (
    c: TenantContext,
    plate: string,
    status: string,
    reg: string | null,
    ins: string | null,
    maint: string | null,
  ) => {
    const id = randomUUID();
    await db.query(
      'insert into vehicles(id,business_id,license_plate,status,registration_expires_on,insurance_expires_on,next_maintenance_on) values($1,$2,$3,$4,$5,$6,$7)',
      [id, c.businessId, plate, status, reg, ins, maint],
    );
    return id;
  };
  const expired = await add(a, 'EXP001', 'ACTIVE', day(-1), day(31), day(30));
  await add(a, 'OK0001', 'ACTIVE', day(31), null, null);
  await add(a, 'OFF001', 'INACTIVE', day(-5), day(-5), day(-5));
  await add(b, 'FOREIGN', 'ACTIVE', day(-5), null, null);
  const page = await service.list(a, query());
  expect(page.data.map((r) => [r.kind, r.severity, r.vehicleId])).toEqual([
    ['VEHICLE_REGISTRATION_DUE', 'CRITICAL', expired],
    ['VEHICLE_MAINTENANCE_DUE', 'WARNING', expired],
  ]);
  expect(page.stats).toMatchObject({
    total: 2,
    critical: 1,
    warning: 1,
    vehicleCompliance: 2,
  });
  expect(page.rules.complianceWarningDays).toBe(30);
  expect(
    (await service.list(a, query({ kind: 'VEHICLE_INSURANCE_DUE' }))).total,
  ).toBe(0);
  expect(
    (await service.list(a, query({ vehicleId: expired }))).total,
  ).toBe(2);
});
