import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { count, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Database } from '../database/database.js';
import * as schema from '../database/schema.js';
import type { TenantContext } from '../auth/guards.js';
import { FleetService } from '../fleet/fleet.service.js';
import { CustomerQuery, RentalQuery, VehicleAvailabilityQuery } from './dto.js';
import { RentalService, translateRentalConflict } from './rental.service.js';
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let service: RentalService;
let fleet: FleetService;
let a: TenantContext;
let b: TenantContext;
let ops: TenantContext;
const time = (delta: number) => new Date(Date.now() + delta).toISOString();
const minute = 60_000;
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
async function fixtures(c = a) {
  const customer = await service.createCustomer(
    c,
    { name: 'Fixture customer', email: 'fixture@example.test' },
    'customer',
  );
  const vehicle = await fleet.createVehicle(
    c,
    {
      licensePlate:
        'QA' + randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase(),
      make: 'Toyota',
      model: 'Vios',
    },
    'vehicle',
  );
  return {
    customer,
    vehicle,
    body: {
      customerId: customer.id,
      vehicleId: vehicle.id,
      startAt: time(-minute),
      endAt: time(60 * minute),
      rentalAmount: 125.55,
      depositRequiredAmount: 50.25,
    },
  };
}
beforeAll(async () => {
  client = new PGlite({ extensions: { btree_gist } });
  await client.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  for (const file of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await client.exec(
      readFileSync('../../supabase/migrations/' + file, 'utf8'),
    );
  db = drizzle(client, { schema });
  service = new RentalService({ db } as unknown as Database);
  fleet = new FleetService({ db } as unknown as Database);
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
it('runs the complete lifecycle, exact monetary serialization, immutable terminal state and minimal audit', async () => {
  const { body, vehicle } = await fixtures();
  const draft = await service.createRental(a, body, 'draft');
  expect(draft).toMatchObject({
    status: 'DRAFT',
    rentalAmount: 125.55,
    depositRequiredAmount: 50.25,
    isOverdue: false,
    customerId: body.customerId,
    vehicleId: body.vehicleId,
  });
  const reserved = await service.reserve(a, draft.id, 'reserve');
  expect(reserved.status).toBe('RESERVED');
  await expect(service.reserve(a, draft.id, 'repeat')).rejects.toMatchObject({
    response: { code: 'INVALID_RENTAL_STATE' },
  });
  await expect(
    service.updateRental(
      a,
      draft.id,
      { customerId: body.customerId },
      'locked',
    ),
  ).rejects.toMatchObject({ response: { code: 'RENTAL_FIELDS_LOCKED' } });
  const active = await service.handover(
    a,
    draft.id,
    { odometerStart: 1000 },
    'handover',
  );
  expect(active.status).toBe('ACTIVE');
  await expect(
    service.cancel(a, draft.id, {}, 'cancel-active'),
  ).rejects.toMatchObject({ response: { code: 'INVALID_RENTAL_STATE' } });
  await service.updateRental(
    a,
    draft.id,
    { depositReceived: true, notes: 'Private rental notes' },
    'update',
  );
  const extended = await service.extend(
    a,
    draft.id,
    { endAt: time(120 * minute), rentalAmount: 250.75 },
    'extend',
  );
  expect(extended.rentalAmount).toBe(250.75);
  await expect(
    service.returnRental(a, draft.id, { odometerEnd: 999 }, 'bad-return'),
  ).rejects.toMatchObject({ response: { code: 'INVALID_ODOMETER' } });
  const completed = await service.returnRental(
    a,
    draft.id,
    { odometerEnd: 1100 },
    'return',
  );
  expect(completed).toMatchObject({
    status: 'COMPLETED',
    odometerStart: 1000,
    odometerEnd: 1100,
    depositReceived: true,
    isOverdue: false,
  });
  expect(completed.returnedAt!.getTime()).toBeGreaterThanOrEqual(
    completed.handedOverAt!.getTime(),
  );
  await expect(
    service.updateRental(a, draft.id, { notes: 'rewritten' }, 'terminal'),
  ).rejects.toMatchObject({ response: { code: 'INVALID_RENTAL_STATE' } });
  await expect(
    service.returnRental(a, draft.id, { odometerEnd: 1100 }, 'repeat'),
  ).rejects.toMatchObject({ response: { code: 'INVALID_RENTAL_STATE' } });
  expect((await fleet.vehicle(a, vehicle.id)).status).toBe('ACTIVE');
  const audits = await db
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.entityId, draft.id));
  expect(audits.map((row) => row.action)).toEqual([
    'rental.create',
    'rental.reserve',
    'rental.handover',
    'rental.update',
    'rental.extend',
    'rental.return',
  ]);
  expect(JSON.stringify(audits)).not.toContain('Private rental notes');
  expect(JSON.stringify(audits)).not.toContain('fixture@example.test');
  expect(
    audits.every(
      (row) =>
        Object.keys(row.metadata as object)
          .sort()
          .join() === 'fields,requestId',
    ),
  ).toBe(true);
});
it('keeps drafts nonblocking, rejects overlapping reserve/extend and permits adjacent UTC intervals', async () => {
  const { body } = await fixtures();
  const first = await service.createRental(a, body, 'first');
  const second = await service.createRental(a, body, 'second');
  const free = await service.availability(
    a,
    Object.assign(new VehicleAvailabilityQuery(), {
      startAt: body.startAt,
      endAt: body.endAt,
    }),
  );
  expect(free.data[0].available).toBe(true);
  await service.reserve(a, first.id, 'reserve');
  await expect(service.reserve(a, second.id, 'overlap')).rejects.toMatchObject({
    response: { code: 'RENTAL_CONFLICT' },
  });
  const next = await service.createRental(
    a,
    { ...body, startAt: first.endAt.toISOString(), endAt: time(180 * minute) },
    'next',
  );
  await service.reserve(a, next.id, 'adjacent');
  await expect(
    service.extend(a, first.id, { endAt: time(121 * minute) }, 'overlap'),
  ).rejects.toMatchObject({ response: { code: 'RENTAL_CONFLICT' } });
  expect((await service.rental(a, first.id)).endAt).toEqual(first.endAt);
  await service.cancel(
    a,
    first.id,
    { notes: 'Cancelled by operator' },
    'cancel',
  );
  await service.reserve(a, second.id, 'freed');
  await expect(service.cancel(a, first.id, {}, 'repeat')).rejects.toMatchObject(
    { response: { code: 'INVALID_RENTAL_STATE' } },
  );
});
it('blocks disabling customers and vehicles with live reservations then releases after cancellation', async () => {
  const { body } = await fixtures();
  const rental = await service.createRental(a, body, 'draft');
  await service.reserve(a, rental.id, 'reserve');
  await expect(
    service.updateCustomer(
      a,
      body.customerId,
      { status: 'INACTIVE' },
      'disable',
    ),
  ).rejects.toMatchObject({ response: { code: 'RESOURCE_HAS_RENTAL' } });
  await expect(
    fleet.updateVehicle(a, body.vehicleId, { status: 'INACTIVE' }, 'disable'),
  ).rejects.toMatchObject({ response: { code: 'RESOURCE_HAS_RENTAL' } });
  await service.cancel(a, rental.id, {}, 'cancel');
  await service.updateCustomer(
    a,
    body.customerId,
    { status: 'INACTIVE' },
    'disable',
  );
  await fleet.updateVehicle(
    a,
    body.vehicleId,
    { status: 'INACTIVE' },
    'disable',
  );
  expect((await service.customer(a, body.customerId)).status).toBe('INACTIVE');
});
it('checks active resources again at reserve and rejects inactive draft resources', async () => {
  const { body } = await fixtures();
  const draft = await service.createRental(a, body, 'draft');
  await fleet.updateVehicle(
    a,
    body.vehicleId,
    { status: 'INACTIVE' },
    'disable',
  );
  await expect(service.reserve(a, draft.id, 'inactive')).rejects.toMatchObject({
    response: { code: 'VEHICLE_INACTIVE' },
  });
  await expect(service.createRental(a, body, 'inactive')).rejects.toMatchObject(
    { response: { code: 'VEHICLE_INACTIVE' } },
  );
  await fleet.updateVehicle(a, body.vehicleId, { status: 'ACTIVE' }, 'enable');
  await service.updateCustomer(
    a,
    body.customerId,
    { status: 'INACTIVE' },
    'disable',
  );
  await expect(service.reserve(a, draft.id, 'inactive')).rejects.toMatchObject({
    response: { code: 'CUSTOMER_INACTIVE' },
  });
});
it('rejects expired periods, premature handover, invalid extension and inverted windows', async () => {
  const { body } = await fixtures();
  await expect(
    service.createRental(a, { ...body, endAt: body.startAt }, 'range'),
  ).rejects.toMatchObject({ response: { code: 'INVALID_RENTAL_RANGE' } });
  const expired = await service.createRental(
    a,
    { ...body, startAt: time(-60 * minute), endAt: time(-minute) },
    'expired',
  );
  await expect(service.reserve(a, expired.id, 'expired')).rejects.toMatchObject(
    { response: { code: 'RENTAL_EXPIRED' } },
  );
  const future = await service.createRental(
    a,
    { ...body, startAt: time(60 * minute), endAt: time(120 * minute) },
    'future',
  );
  await service.reserve(a, future.id, 'reserve');
  await expect(
    service.handover(a, future.id, { odometerStart: 0 }, 'early'),
  ).rejects.toMatchObject({ response: { code: 'RENTAL_NOT_STARTED' } });
  await expect(
    service.extend(
      a,
      future.id,
      { endAt: future.endAt.toISOString() },
      'short',
    ),
  ).rejects.toMatchObject({ response: { code: 'INVALID_EXTENSION' } });
});
it('derives overdue, conservatively blocks later reservations, returns safely and never persists OVERDUE', async () => {
  const { body } = await fixtures();
  const draft = await service.createRental(a, body, 'draft');
  await service.reserve(a, draft.id, 'reserve');
  await service.handover(a, draft.id, { odometerStart: 500 }, 'handover');
  await db
    .update(schema.rentals)
    .set({
      startAt: new Date(Date.now() - 60 * minute),
      endAt: new Date(Date.now() - minute),
    })
    .where(eq(schema.rentals.id, draft.id));
  const overdue = await service.rental(a, draft.id);
  expect(overdue).toMatchObject({ status: 'ACTIVE', isOverdue: true });
  const state = await service.vehicleRentalState(a, body.vehicleId);
  expect(state).toMatchObject({
    state: 'OVERDUE',
    currentRental: { id: draft.id },
    nextRental: null,
  });
  const query = Object.assign(new VehicleAvailabilityQuery(), {
    startAt: time(60 * minute),
    endAt: time(120 * minute),
  });
  expect((await service.availability(a, query)).data[0]).toMatchObject({
    available: false,
    reason: 'OVERDUE',
  });
  const later = await service.createRental(
    a,
    { ...body, startAt: query.startAt, endAt: query.endAt },
    'later',
  );
  await expect(service.reserve(a, later.id, 'blocked')).rejects.toMatchObject({
    response: { code: 'RENTAL_CONFLICT' },
  });
  expect(
    (
      await service.listRentals(
        a,
        Object.assign(new RentalQuery(), { overdue: true }),
      )
    ).data.map((row) => row.id),
  ).toEqual([draft.id]);
  await service.returnRental(a, draft.id, { odometerEnd: 500 }, 'return');
  await service.reserve(a, later.id, 'released');
  expect((await service.vehicleRentalState(a, body.vehicleId)).state).toBe(
    'AVAILABLE',
  );
  expect(
    (await service.vehicleRentalState(a, body.vehicleId)).nextRental?.id,
  ).toBe(later.id);
});
it('keeps expired reservations from handover but permits a validated future extension', async () => {
  const { body } = await fixtures();
  const rental = await service.createRental(a, body, 'draft');
  await service.reserve(a, rental.id, 'reserve');
  await db
    .update(schema.rentals)
    .set({
      startAt: new Date(Date.now() - 60 * minute),
      endAt: new Date(Date.now() - minute),
    })
    .where(eq(schema.rentals.id, rental.id));
  await expect(
    service.handover(a, rental.id, { odometerStart: 1 }, 'expired'),
  ).rejects.toMatchObject({ response: { code: 'RENTAL_EXPIRED' } });
  await service.extend(a, rental.id, { endAt: time(60 * minute) }, 'extend');
  expect(
    (await service.handover(a, rental.id, { odometerStart: 1 }, 'handover'))
      .status,
  ).toBe('ACTIVE');
});
it('scopes all reads, writes, foreign resources, availability and vehicle-state to the verified tenant', async () => {
  const { body, customer, vehicle } = await fixtures();
  const rental = await service.createRental(a, body, 'draft');
  const other = await fixtures(b);
  await expect(service.customer(b, customer.id)).rejects.toMatchObject({
    response: { code: 'CUSTOMER_NOT_FOUND' },
  });
  await expect(
    service.updateCustomer(b, customer.id, { name: 'forged' }, 'forged'),
  ).rejects.toMatchObject({ response: { code: 'CUSTOMER_NOT_FOUND' } });
  await expect(service.rental(b, rental.id)).rejects.toMatchObject({
    response: { code: 'RENTAL_NOT_FOUND' },
  });
  for (const action of [
    () => service.updateRental(b, rental.id, { notes: 'forged' }, 'forged'),
    () => service.reserve(b, rental.id, 'forged'),
    () => service.handover(b, rental.id, { odometerStart: 1 }, 'forged'),
    () => service.extend(b, rental.id, { endAt: time(120 * minute) }, 'forged'),
    () => service.returnRental(b, rental.id, { odometerEnd: 1 }, 'forged'),
    () => service.cancel(b, rental.id, {}, 'forged'),
  ])
    await expect(action()).rejects.toMatchObject({
      response: { code: 'RENTAL_NOT_FOUND' },
    });
  await expect(
    service.createRental(
      a,
      { ...body, customerId: other.customer.id },
      'forged',
    ),
  ).rejects.toMatchObject({ response: { code: 'CUSTOMER_NOT_FOUND' } });
  await expect(
    service.updateRental(
      a,
      rental.id,
      { vehicleId: other.vehicle.id },
      'forged',
    ),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
  await expect(service.vehicleRentalState(b, vehicle.id)).rejects.toMatchObject(
    { response: { code: 'VEHICLE_NOT_FOUND' } },
  );
  expect((await service.listRentals(b, new RentalQuery())).data).toEqual([]);
  expect(
    (await service.listCustomers(b, new CustomerQuery())).data.map(
      (row) => row.id,
    ),
  ).toEqual([other.customer.id]);
  expect(
    (
      await service.availability(
        b,
        Object.assign(new VehicleAvailabilityQuery(), {
          startAt: body.startAt,
          endAt: body.endAt,
        }),
      )
    ).data.map((row) => row.id),
  ).toEqual([other.vehicle.id]);
});
it('validates merged customer contacts without globally deduplicating households and supports literal search', async () => {
  await expect(
    service.createCustomer(a, { name: 'No contacts' }, 'invalid'),
  ).rejects.toMatchObject({ response: { code: 'CUSTOMER_CONTACT_REQUIRED' } });
  const first = await service.createCustomer(
    a,
    { name: 'A_100', email: 'shared@example.test' },
    'first',
  );
  await service.createCustomer(
    a,
    { name: 'AB100', email: 'shared@example.test' },
    'shared',
  );
  await expect(
    service.updateCustomer(a, first.id, { email: '' }, 'empty'),
  ).rejects.toMatchObject({ response: { code: 'CUSTOMER_CONTACT_REQUIRED' } });
  await service.updateCustomer(
    a,
    first.id,
    { email: '', phone: '12345' },
    'replacement',
  );
  expect(
    (
      await service.listCustomers(
        a,
        Object.assign(new CustomerQuery(), { search: 'A_100' }),
      )
    ).data.map((row) => row.id),
  ).toEqual([first.id]);
});
it.each(['role', 'membership', 'profile', 'business'])(
  'rechecks %s under the tenant lock for customer and rental writes',
  async (scenario) => {
    const { body } = await fixtures();
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
    const code =
      scenario === 'role' ? 'PERMISSION_DENIED' : 'TENANT_ACCESS_DENIED';
    await expect(service.createRental(a, body, 'stale')).rejects.toMatchObject({
      response: { code },
    });
    await expect(
      service.createCustomer(a, { name: 'Stale', phone: '12345' }, 'stale'),
    ).rejects.toMatchObject({ response: { code } });
    expect(
      (
        await db
          .select({ total: count() })
          .from(schema.rentals)
          .where(eq(schema.rentals.businessId, a.businessId))
      )[0].total,
    ).toBe(0);
  },
);
it('allows OPERATIONS reads while rejecting service writes and accepts ADMIN manage', async () => {
  const { body } = await fixtures();
  const rental = await service.createRental(a, body, 'draft');
  expect((await service.listRentals(ops, new RentalQuery())).total).toBe(1);
  expect((await service.listCustomers(ops, new CustomerQuery())).total).toBe(1);
  await expect(service.reserve(ops, rental.id, 'ops')).rejects.toMatchObject({
    response: { code: 'PERMISSION_DENIED' },
  });
  await expect(
    service.createCustomer(ops, { name: 'Ops', phone: '12345' }, 'ops'),
  ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  const admin = await actor(a.businessId, 'ADMIN');
  expect((await service.reserve(admin, rental.id, 'admin')).status).toBe(
    'RESERVED',
  );
});
it('rolls back both newly created resources and transitions when atomic audit insertion fails', async () => {
  const { body } = await fixtures();
  const rental = await service.createRental(a, body, 'draft');
  await client.exec(
    "alter table audit_logs add constraint rental_audit_failure check(action not in ('customer.create', 'rental.reserve')) not valid",
  );
  try {
    await expect(
      service.createCustomer(a, { name: 'Rollback', phone: '12345' }, 'audit'),
    ).rejects.toBeDefined();
    expect((await service.listCustomers(a, new CustomerQuery())).total).toBe(1);
    await expect(service.reserve(a, rental.id, 'audit')).rejects.toBeDefined();
    expect((await service.rental(a, rental.id)).status).toBe('DRAFT');
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint rental_audit_failure',
    );
  }
});
it('translates known wrapped PostgreSQL race constraints without leaking database internals', () => {
  for (const [code, constraint, expected] of [
    ['23P01', 'rentals_blocking_vehicle_time_exclusion', 'RENTAL_CONFLICT'],
    ['23505', 'rentals_active_vehicle_unique', 'VEHICLE_RENTED'],
  ]) {
    try {
      translateRentalConflict({
        cause: { code, constraint, detail: 'secret' },
      });
    } catch (error) {
      expect(error).toMatchObject({ response: { code: expected } });
      expect(JSON.stringify(error)).not.toContain('secret');
    }
  }
  const unknown = new Error('unknown');
  expect(() => translateRentalConflict(unknown)).toThrow(unknown);
});
