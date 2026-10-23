import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/database.js';
import type { TenantContext } from '../../auth/guards.js';
import { TripQuery, TripRouteQuery } from './dto.js';
import { TRIP_POINT_CAP } from './domain.js';
import { TripService } from './trip.service.js';
let db: PGlite, service: TripService;
const businessA = randomUUID(),
  businessB = randomUUID(),
  vehicleA = randomUUID(),
  vehicleB = randomUUID(),
  assignmentA = randomUUID(),
  assignmentB = randomUUID(),
  deviceA = randomUUID(),
  deviceB = randomUUID(),
  rentalId = randomUUID();
const base = new Date(Date.now() - 3600000);
const range = {
  from: new Date(base.getTime() - 60000).toISOString(),
  to: new Date(base.getTime() + 20 * 60000).toISOString(),
};
const tenant = (businessId = businessA) =>
  ({ businessId, role: 'OWNER' }) as TenantContext;
const query = (extra = {}) => Object.assign(new TripQuery(), range, extra);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create table vehicles(id uuid,business_id uuid,license_plate text);
    create table device_assignments(id uuid,business_id uuid,vehicle_id uuid,device_id uuid,assigned_at timestamptz,unassigned_at timestamptz);
    create table gps_positions(id uuid,business_id uuid,vehicle_id uuid,assignment_id uuid,device_id uuid,recorded_at timestamptz,received_at timestamptz,latitude float8,longitude float8,speed_kph float8,heading float8,ignition boolean,source_mode text);
    create table rentals(id uuid,business_id uuid,vehicle_id uuid,start_at timestamptz,end_at timestamptz,status text);`);
  // Exercise the production SQL against a real PostgreSQL-compatible engine, not a query-shaped mock.
  service = new TripService({
    pool: { query: (sql: string, params: unknown[]) => db.query(sql, params) },
  } as unknown as Database);
  for (const [business, vehicle, assignment, device, plate] of [
    [businessA, vehicleA, assignmentA, deviceA, 'TENANTA'],
    [businessB, vehicleB, assignmentB, deviceB, 'TENANTB'],
  ]) {
    await db.query('insert into vehicles values($1,$2,$3)', [
      vehicle,
      business,
      plate,
    ]);
    await db.query(
      'insert into device_assignments values($1,$2,$3,$4,$5,null)',
      [
        assignment,
        business,
        vehicle,
        device,
        new Date(base.getTime() - 600000),
      ],
    );
    for (let i = 0; i < 4; i++)
      await db.query(
        "insert into gps_positions values($1,$2,$3,$4,$5,$6,$7,10.77,$8,20,90,true,'TEST')",
        [
          randomUUID(),
          business,
          vehicle,
          assignment,
          device,
          new Date(base.getTime() + i * 60000),
          new Date(base.getTime() + i * 60000 + 100),
          106.7 + i * 0.0005,
        ],
      );
  }
  await db.query("insert into rentals values($1,$2,$3,$4,$5,'RESERVED')", [
    rentalId,
    businessA,
    vehicleA,
    new Date(base.getTime() - 60000),
    new Date(base.getTime() + 600000),
  ]);
});
afterAll(async () => {
  await db?.close();
});
it('runs tenant-filtered history/detail/route SQL with capped paging and scheduled rental association', async () => {
  const list = await service.list(tenant(), query({ vehicleId: vehicleA }));
  expect(list.total).toBe(1);
  expect(list.data[0]).toMatchObject({
    vehicleId: vehicleA,
    rentalId,
    pointCount: 4,
    sourceMode: 'TEST',
  });
  expect(list.data[0].rentalAssociations).toEqual([
    { rentalId, relation: 'CONTAINED', basis: 'SCHEDULED_WINDOW' },
  ]);
  expect(list.retentionDays).toBe(30);
  const trip = list.data[0];
  expect(await service.get(tenant(), trip.id)).toEqual(trip);
  const first = await service.route(
    tenant(),
    trip.id,
    Object.assign(new TripRouteQuery(), { limit: 2 }),
  );
  const second = await service.route(
    tenant(),
    trip.id,
    Object.assign(new TripRouteQuery(), { limit: 2, page: 2 }),
  );
  expect(first).toMatchObject({ total: 4, hasMore: true, partial: true });
  expect(second.hasMore).toBe(false);
  expect(new Set([...first.data, ...second.data].map((p) => p.id)).size).toBe(
    4,
  );
  expect((await service.list(tenant(), query({ rentalId }))).data[0].id).toBe(
    trip.id,
  );
});
it('prevents cross-tenant filter, detail and route IDOR and keeps unfiltered histories separate', async () => {
  const mine = (await service.list(tenant(), query())).data[0];
  const other = await service.list(tenant(businessB), query());
  expect(other.data.map((t) => t.vehicleId)).toEqual([vehicleB]);
  for (const call of [
    () => service.list(tenant(businessB), query({ vehicleId: vehicleA })),
    () => service.list(tenant(businessB), query({ rentalId })),
    () => service.get(tenant(businessB), mine.id),
    () => service.route(tenant(businessB), mine.id, new TripRouteQuery()),
  ])
    await expect(call()).rejects.toMatchObject({
      response: { code: 'TRIP_NOT_FOUND' },
    });
});
it('returns truthful no-data pages without inventing a route and rejects invalid ranges', async () => {
  const empty = await service.list(
    tenant(),
    query({
      from: new Date(base.getTime() - 600000).toISOString(),
      to: new Date(base.getTime() - 60000).toISOString(),
    }),
  );
  expect(empty).toMatchObject({ data: [], total: 0 });
  await expect(
    service.list(
      tenant(),
      query({ from: new Date(base.getTime() - 8 * 86400000).toISOString() }),
    ),
  ).rejects.toMatchObject({ response: { code: 'INVALID_TRIP_RANGE' } });
});
it('re-derives historical assignments after delayed fixes without touching Stage 5 current-state storage', async () => {
  const old = (await service.list(tenant(), query())).data[0];
  const older = new Date(base.getTime() - 30000);
  await db.query(
    "insert into gps_positions values($1,$2,$3,$4,$5,$6,$7,10.77,106.6995,20,90,true,'TEST')",
    [
      randomUUID(),
      businessA,
      vehicleA,
      assignmentA,
      deviceA,
      older,
      new Date(),
    ],
  );
  const changed = (await service.list(tenant(), query())).data[0];
  expect(changed.id).not.toBe(old.id);
  expect(changed.assignmentId).toBe(assignmentA);
  expect(changed.pointCount).toBe(5);
  await expect(service.get(tenant(), old.id)).rejects.toMatchObject({
    response: { code: 'TRIP_NOT_FOUND' },
  });
});
it('rejects candidate floods rather than returning an apparently complete truncated history', async () => {
  const v = randomUUID(),
    a = randomUUID(),
    d = randomUUID();
  await db.query("insert into vehicles values($1,$2,'FLOOD')", [v, businessA]);
  await db.query('insert into device_assignments values($1,$2,$3,$4,$5,null)', [
    a,
    businessA,
    v,
    d,
    base,
  ]);
  await db.query(
    `insert into gps_positions select gen_random_uuid(),$1,$2,$3,$4,$5::timestamptz+n*interval '1 millisecond',$5::timestamptz,10.77,106.7,20,90,true,'TEST' from generate_series(0,$6::int) n`,
    [businessA, v, a, d, base, TRIP_POINT_CAP],
  );
  await expect(
    service.list(tenant(), query({ vehicleId: v })),
  ).rejects.toMatchObject({ response: { code: 'TRIP_POINT_LIMIT' } });
  // A narrower time window remains usable even on a dense tracker.
  expect(
    (
      await service.list(
        tenant(),
        query({
          vehicleId: v,
          to: new Date(base.getTime() + 1000).toISOString(),
        }),
      )
    ).data[0].pointCount,
  ).toBe(1000);
});
