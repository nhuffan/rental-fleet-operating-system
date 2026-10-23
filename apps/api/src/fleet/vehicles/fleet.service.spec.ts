import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { count, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Database } from '../../database/database.js';
import * as schema from '../../database/schema.js';
import type { TenantContext } from '../../auth/guards.js';
import { GpsDeviceQuery, VehicleQuery } from './dto.js';
import { PageQuery } from '../../core/dto.js';
import { FleetService, translateFleetConflict } from './fleet.service.js';

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let service: FleetService;
let a: TenantContext;
let b: TenantContext;
let ops: TenantContext;
const vehicleBody = (licensePlate = '51A12345') => ({
  licensePlate,
  make: 'Toyota',
  model: 'Vios',
});
const deviceBody = (deviceUid = randomUUID()) => ({
  provider: 'manual',
  deviceUid,
});
async function actor(businessId: string, role = 'OWNER') {
  const userId = randomUUID();
  const membershipId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db.insert(schema.profiles).values({ userId, displayName: 'Fixture' });
  await db
    .insert(schema.memberships)
    .values({ id: membershipId, businessId, userId, roleKey: role });
  return {
    userId,
    email: 'fixture@example.test',
    businessId,
    businessName: 'Fixture',
    role,
    membershipId,
  };
}
beforeAll(async () => {
  client = new PGlite({ extensions: { btree_gist } });
  await client.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  for (const file of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await client.exec(
      readFileSync('../../supabase/migrations/' + file, 'utf8'),
    );
  db = drizzle(client, { schema });
  service = new FleetService({ db } as unknown as Database);
}, 30000);
beforeEach(async () => {
  const [businessA, businessB] = await db
    .insert(schema.businesses)
    .values([{ name: 'A' }, { name: 'B' }])
    .returning();
  a = await actor(businessA.id);
  b = await actor(businessB.id);
  ops = await actor(businessA.id, 'OPERATIONS');
});
afterAll(async () => {
  await client?.close();
});

it('scopes vehicle/device reads, updates, branches and assignments to the verified tenant', async () => {
  const vehicle = await service.createVehicle(a, vehicleBody(), 'create-a');
  const device = await service.createDevice(b, deviceBody(), 'create-b');
  const [branch] = await db
    .insert(schema.branches)
    .values({ businessId: b.businessId, name: 'B only' })
    .returning();
  await expect(service.vehicle(b, vehicle.id)).rejects.toMatchObject({
    response: { code: 'VEHICLE_NOT_FOUND' },
  });
  await expect(
    service.updateVehicle(b, vehicle.id, { model: 'forged' }, 'forged'),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
  await expect(
    service.updateDevice(a, device.id, { label: 'forged' }, 'forged'),
  ).rejects.toMatchObject({ response: { code: 'DEVICE_NOT_FOUND' } });
  await expect(
    service.assignDevice(a, vehicle.id, { deviceId: device.id }, 'forged'),
  ).rejects.toMatchObject({ response: { code: 'DEVICE_NOT_FOUND' } });
  await expect(
    service.updateVehicle(a, vehicle.id, { branchId: branch.id }, 'forged'),
  ).rejects.toMatchObject({ response: { code: 'INVALID_BRANCH' } });
  expect((await service.listVehicles(b, new VehicleQuery())).data).toEqual([]);
  expect((await service.listDevices(a, new GpsDeviceQuery())).data).toEqual([]);
});
it('rejects inactive branches, tenant duplicate plates and global duplicate tracker identity atomically', async () => {
  const [branch] = await db
    .insert(schema.branches)
    .values({ businessId: a.businessId, name: 'Disabled', status: 'DISABLED' })
    .returning();
  await expect(
    service.createVehicle(
      a,
      { ...vehicleBody(), branchId: branch.id },
      'bad-branch',
    ),
  ).rejects.toMatchObject({ response: { code: 'INVALID_BRANCH' } });
  await service.createVehicle(a, vehicleBody(), 'vehicle');
  await expect(
    service.createVehicle(a, vehicleBody(), 'duplicate'),
  ).rejects.toMatchObject({ response: { code: 'PLATE_EXISTS' } });
  await service.createVehicle(b, vehicleBody(), 'other-business');
  const body = deviceBody();
  await service.createDevice(a, body, 'device');
  await expect(
    service.createDevice(b, body, 'duplicate'),
  ).rejects.toMatchObject({ response: { code: 'DEVICE_UID_EXISTS' } });
  const audit = await db
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.businessId, a.businessId));
  expect(audit.map((row) => row.action)).toEqual([
    'vehicle.create',
    'gps_device.create',
  ]);
  expect(audit[0].metadata).toEqual({
    requestId: 'vehicle',
    fields: ['licensePlate', 'make', 'model'],
  });
  expect(JSON.stringify(audit)).not.toContain('51A12345');
});
it('ends and reassigns devices while preserving history and preventing duplicate active assignments', async () => {
  const vehicle = await service.createVehicle(a, vehicleBody(), 'vehicle');
  const other = await service.createVehicle(
    a,
    vehicleBody('51B12345'),
    'other',
  );
  const device = await service.createDevice(a, deviceBody(), 'device');
  const another = await service.createDevice(a, deviceBody(), 'another');
  const first = await service.assignDevice(
    a,
    vehicle.id,
    { deviceId: device.id },
    'assign',
  );
  await expect(
    service.assignDevice(a, vehicle.id, { deviceId: another.id }, 'again'),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_ASSIGNED' } });
  await expect(
    service.assignDevice(a, other.id, { deviceId: device.id }, 'again'),
  ).rejects.toMatchObject({ response: { code: 'DEVICE_ASSIGNED' } });
  await expect(
    service.updateVehicle(a, vehicle.id, { status: 'INACTIVE' }, 'disable'),
  ).rejects.toMatchObject({ response: { code: 'RESOURCE_HAS_ASSIGNMENT' } });
  await expect(
    service.updateDevice(a, device.id, { status: 'INACTIVE' }, 'disable'),
  ).rejects.toMatchObject({ response: { code: 'RESOURCE_HAS_ASSIGNMENT' } });
  await expect(
    service.endAssignment(b, vehicle.id, first.id, 'forged'),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
  await service.endAssignment(a, vehicle.id, first.id, 'end');
  await expect(
    service.endAssignment(a, vehicle.id, first.id, 'again'),
  ).rejects.toMatchObject({ response: { code: 'ASSIGNMENT_ENDED' } });
  const second = await service.assignDevice(
    a,
    vehicle.id,
    { deviceId: another.id },
    'reassign',
  );
  const history = await service.listAssignments(a, vehicle.id, new PageQuery());
  expect(history.total).toBe(2);
  expect(
    history.data.find((row) => row.id === first.id)?.unassignedAt,
  ).toBeInstanceOf(Date);
  expect(
    history.data.find((row) => row.id === second.id)?.unassignedAt,
  ).toBeNull();
  expect((await service.vehicle(a, vehicle.id)).currentAssignment?.id).toBe(
    second.id,
  );
  const available = await service.listDevices(
    a,
    Object.assign(new GpsDeviceQuery(), { available: true }),
  );
  expect(available.data.map((row) => row.id)).toEqual([device.id]);
});
it('requires active resources and permits disabling after ending an assignment', async () => {
  const vehicle = await service.createVehicle(
    a,
    { ...vehicleBody(), status: 'INACTIVE' },
    'vehicle',
  );
  const device = await service.createDevice(a, deviceBody(), 'device');
  await expect(
    service.assignDevice(a, vehicle.id, { deviceId: device.id }, 'assign'),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_INACTIVE' } });
  await service.updateVehicle(a, vehicle.id, { status: 'ACTIVE' }, 'activate');
  await service.updateDevice(a, device.id, { status: 'INACTIVE' }, 'disable');
  await expect(
    service.assignDevice(a, vehicle.id, { deviceId: device.id }, 'assign'),
  ).rejects.toMatchObject({ response: { code: 'DEVICE_INACTIVE' } });
});
it('keeps assignment intervals valid if the database clock moves behind an existing start time', async () => {
  const vehicle = await service.createVehicle(a, vehicleBody(), 'vehicle');
  const device = await service.createDevice(a, deviceBody(), 'device');
  const assignment = await service.assignDevice(
    a,
    vehicle.id,
    { deviceId: device.id },
    'assign',
  );
  const future = new Date(Date.now() + 60_000);
  await db
    .update(schema.deviceAssignments)
    .set({ assignedAt: future })
    .where(eq(schema.deviceAssignments.id, assignment.id));
  const ended = await service.endAssignment(
    a,
    vehicle.id,
    assignment.id,
    'end',
  );
  expect(ended.unassignedAt?.getTime()).toBeGreaterThanOrEqual(
    future.getTime(),
  );
});
it('applies literal search, deterministic sorting, filtering and pagination', async () => {
  await service.createVehicle(
    a,
    { ...vehicleBody('51A12345'), make: 'A_100' },
    'first',
  );
  await service.createVehicle(
    a,
    { ...vehicleBody('51B12345'), make: 'AB100', status: 'INACTIVE' },
    'second',
  );
  const query = Object.assign(new VehicleQuery(), {
    limit: 1,
    sort: 'licensePlate',
    order: 'asc',
  });
  expect((await service.listVehicles(a, query)).data[0].licensePlate).toBe(
    '51A12345',
  );
  expect(
    (await service.listVehicles(a, Object.assign(query, { page: 2 }))).data[0]
      .licensePlate,
  ).toBe('51B12345');
  expect(
    (
      await service.listVehicles(
        a,
        Object.assign(new VehicleQuery(), { search: 'A_100' }),
      )
    ).total,
  ).toBe(1);
  expect(
    (
      await service.listVehicles(
        a,
        Object.assign(new VehicleQuery(), { status: 'INACTIVE' }),
      )
    ).total,
  ).toBe(1);
});
it.each(['role', 'membership', 'profile', 'business'])(
  'rechecks %s after acquiring the tenant lock rather than trusting the guard context',
  async (scenario) => {
    if (scenario === 'role')
      await db
        .update(schema.memberships)
        .set({ roleKey: 'OPERATIONS' })
        .where(eq(schema.memberships.id, a.membershipId));
    if (scenario === 'membership')
      await db
        .update(schema.memberships)
        .set({ status: 'DISABLED' })
        .where(eq(schema.memberships.id, a.membershipId));
    if (scenario === 'profile')
      await db
        .update(schema.profiles)
        .set({ status: 'DISABLED' })
        .where(eq(schema.profiles.userId, a.userId));
    if (scenario === 'business')
      await db
        .update(schema.businesses)
        .set({ status: 'DISABLED' })
        .where(eq(schema.businesses.id, a.businessId));
    await expect(
      service.createVehicle(a, vehicleBody(), 'stale-context'),
    ).rejects.toMatchObject({
      response: {
        code:
          scenario === 'role' ? 'PERMISSION_DENIED' : 'TENANT_ACCESS_DENIED',
      },
    });
    expect(
      (
        await db
          .select({ total: count() })
          .from(schema.vehicles)
          .where(eq(schema.vehicles.businessId, a.businessId))
      )[0].total,
    ).toBe(0);
  },
);
it('allows operations fleet reads and rejects service writes even if a controller check were bypassed', async () => {
  await service.createVehicle(a, vehicleBody(), 'owner');
  expect((await service.listVehicles(ops, new VehicleQuery())).total).toBe(1);
  await expect(
    service.createVehicle(ops, vehicleBody('51C12345'), 'ops'),
  ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  await expect(
    service.createDevice(ops, deviceBody(), 'ops'),
  ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
});
it('rolls back the resource if its audit insert fails', async () => {
  await client.exec(
    "alter table audit_logs add constraint service_audit_failure check(action <> 'vehicle.create') not valid",
  );
  try {
    await expect(
      service.createVehicle(a, vehicleBody(), 'audit-fail'),
    ).rejects.toBeDefined();
    expect((await service.listVehicles(a, new VehicleQuery())).total).toBe(0);
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint service_audit_failure',
    );
  }
});
it('translates wrapped race conflicts without exposing database details', () => {
  for (const [constraint, code] of [
    ['vehicles_business_plate_unique', 'PLATE_EXISTS'],
    ['gps_devices_provider_uid_unique', 'DEVICE_UID_EXISTS'],
    ['device_assignments_active_vehicle_unique', 'VEHICLE_ASSIGNED'],
    ['device_assignments_active_device_unique', 'DEVICE_ASSIGNED'],
  ]) {
    try {
      translateFleetConflict({ cause: { code: '23505', constraint } });
    } catch (error) {
      expect(error).toMatchObject({ response: { code } });
    }
  }
  const unknown = new Error('unknown error');
  expect(() => translateFleetConflict(unknown)).toThrow(unknown);
});
