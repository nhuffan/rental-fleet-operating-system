import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/database.js';
import type { TenantContext } from '../../auth/guards.js';
import { GpsService } from './gps.service.js';
let db: PGlite, service: GpsService;
const businessA = randomUUID(),
  businessB = randomUUID();
const context = (businessId: string) =>
  ({ businessId, role: 'OWNER' }) as TenantContext;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create table vehicles(id uuid,business_id uuid,license_plate text,make text,model text);
    create table device_assignments(id uuid,business_id uuid,vehicle_id uuid,device_id uuid,unassigned_at timestamptz);
    create table gps_devices(id uuid,business_id uuid);
    create table gps_positions(id uuid,business_id uuid,assignment_id uuid,device_id uuid,vehicle_id uuid,recorded_at timestamptz,received_at timestamptz,latitude float8,longitude float8,speed_kph float8,heading float8,ignition boolean,source_mode text);
    create table rentals(id uuid,business_id uuid,vehicle_id uuid,status text);`);
  service = new GpsService({
    pool: { query: (sql: string, params: unknown[]) => db.query(sql, params) },
  } as unknown as Database);
  for (const [business, states] of [
    [businessA, ['FRESH', 'NO_DATA', 'UNASSIGNED']],
    [businessB, ['OFFLINE']],
  ] as const) {
    for (const state of states) {
      const vehicle = randomUUID(),
        device = randomUUID(),
        assignment = randomUUID();
      await db.query(
        "insert into vehicles values($1,$2,$3,'Test','Diagnostics')",
        [vehicle, business, 'PRIVATE-' + state],
      );
      if (state === 'UNASSIGNED') continue;
      await db.query('insert into gps_devices values($1,$2)', [
        device,
        business,
      ]);
      await db.query(
        'insert into device_assignments values($1,$2,$3,$4,null)',
        [assignment, business, vehicle, device],
      );
      if (state === 'NO_DATA') continue;
      await db.query(
        `insert into gps_positions values($1,$2,$3,$4,$5,statement_timestamp()-$6::interval,statement_timestamp()-$7::interval,10.77,106.7,20,90,true,'TEST')`,
        [
          randomUUID(),
          business,
          assignment,
          device,
          vehicle,
          state === 'FRESH' ? '1 second' : '2 hours',
          state === 'FRESH' ? '1 second' : '30 minutes',
        ],
      );
    }
  }
});
afterAll(async () => {
  await db?.close();
});
it('returns tenant-only durable recent ingestion and current freshness without identifiers or coordinates', async () => {
  const result = await service.diagnostics(context(businessA));
  expect(result).toMatchObject({
    sourceMode: 'TEST',
    recent: { windowSeconds: 900, positions: 1, devices: 1 },
    freshness: { FRESH: 1, STALE: 0, OFFLINE: 0, NO_DATA: 1, UNASSIGNED: 1 },
    limiterScope: 'PROCESS_LOCAL',
    failureReporting: 'INTERNAL_AGGREGATE_LOGS',
  });
  expect(result.recent.lastReceivedAt).toMatch(/Z$/);
  expect(result.recent.lastRecordedAt).toMatch(/Z$/);
  const serialized = JSON.stringify(result);
  for (const secret of [
    businessA,
    businessB,
    'PRIVATE-',
    'latitude',
    'longitude',
    'deviceId',
    'deviceUid',
    'eventKey',
    'authenticationRejected',
  ])
    expect(serialized).not.toContain(secret);
});
it('does not count another tenant or mistake an old received fix for recent ingestion', async () => {
  const result = await service.diagnostics(context(businessB));
  expect(result.recent).toEqual({
    windowSeconds: 900,
    positions: 0,
    devices: 0,
    lastReceivedAt: null,
    lastRecordedAt: null,
  });
  expect(result.freshness).toEqual({
    FRESH: 0,
    STALE: 0,
    OFFLINE: 1,
    NO_DATA: 0,
    UNASSIGNED: 0,
  });
  expect((await service.diagnostics(context(randomUUID()))).freshness).toEqual({
    FRESH: 0,
    STALE: 0,
    OFFLINE: 0,
    NO_DATA: 0,
    UNASSIGNED: 0,
  });
});
