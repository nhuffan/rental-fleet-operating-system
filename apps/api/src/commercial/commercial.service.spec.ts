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
import { permissionsFor } from '../auth/permissions.js';
import { RentalService } from '../rentals/rental.service.js';
import { CoreService } from '../core/core.service.js';
import { CommercialService } from './commercial.service.js';
import {
  CommercialMovementQuery,
  type CommercialMovementCreate,
} from './dto.js';
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let service: CommercialService;
let rentalService: RentalService;
let a: TenantContext, b: TenantContext;
const time = (offset: number) => new Date(Date.now() + offset).toISOString();
async function actor(businessId: string) {
  const userId = randomUUID(),
    membershipId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db.insert(schema.profiles).values({ userId, displayName: 'Fixture' });
  await db
    .insert(schema.memberships)
    .values({ id: membershipId, businessId, userId, roleKey: 'OWNER' });
  return {
    userId,
    email: 'fixture@example.test',
    membershipId,
    businessId,
    businessName: 'Fixture',
    role: 'OWNER',
  };
}
async function rental(c = a) {
  const [customer] = await db
    .insert(schema.customers)
    .values({ businessId: c.businessId, name: 'Fixture', phone: '12345' })
    .returning();
  const [vehicle] = await db
    .insert(schema.vehicles)
    .values({
      businessId: c.businessId,
      licensePlate:
        'QA' + randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase(),
      make: 'Fixture',
      model: 'Fixture',
    })
    .returning();
  const [row] = await db
    .insert(schema.rentals)
    .values({
      businessId: c.businessId,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startAt: new Date(time(-3600000)),
      endAt: new Date(time(3600000)),
      rentalAmount: '125.55',
      depositRequiredAmount: '50.25',
    })
    .returning();
  return row;
}
async function movement(
  kind: CommercialMovementCreate['kind'],
  amount: string,
  rentalId?: string,
  extras: Partial<CommercialMovementCreate> = {},
  c = a,
) {
  return service.create(
    c,
    {
      kind,
      amount,
      category:
        kind === 'EXPENSE'
          ? 'OTHER_EXPENSE'
          : kind === 'MISC_INCOME'
            ? 'OTHER_INCOME'
            : kind === 'RENTAL_PAYMENT'
              ? 'RENTAL'
              : 'DEPOSIT',
      occurredAt: time(-60000),
      rentalId,
      ...extras,
    },
    'fixture-request',
  );
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
  service = new CommercialService({ db } as unknown as Database);
  rentalService = new RentalService({ db } as unknown as Database);
}, 30000);
beforeEach(async () => {
  const [businessA, businessB] = await db
    .insert(schema.businesses)
    .values([{ name: 'A' }, { name: 'B' }])
    .returning();
  a = await actor(businessA.id);
  b = await actor(businessB.id);
});
afterAll(async () => {
  await client?.close();
});
it('reconciles receipts, operating profit and deposits without counting contracted/required amounts', async () => {
  const r = await rental();
  await movement('RENTAL_PAYMENT', '100', r.id);
  await movement('MISC_INCOME', '20', r.id);
  await movement('EXPENSE', '30', r.id);
  await movement('DEPOSIT_RECEIPT', '50', r.id, { occurredAt: time(-120000) });
  await movement('DEPOSIT_RETAIN', '10', r.id);
  await movement('DEPOSIT_REFUND', '15', r.id);
  const result = await service.rentalSummary(a, r.id);
  expect(result).toMatchObject({
    contractedAmount: '126',
    recordedRentalPayments: '100',
    outstandingAmount: '26',
    overpaidAmount: '0',
    depositRequired: '50',
    depositReceived: '50',
    depositRefunded: '15',
    depositRetained: '10',
    depositBalance: '25',
    summary: {
      recordedRevenue: '130',
      cashReceived: '120',
      operatingExpenses: '30',
      estimatedProfit: '100',
      netOperatingCashFlow: '90',
      depositHeld: '25',
    },
  });
  expect(
    (await service.summary(a, { vehicleId: r.vehicleId })).recordedRevenue,
  ).toBe('130');
});
it('sums beyond safe integer precision using SQL numeric and exact BigInt differences', async () => {
  for (let i = 0; i < 10; i++) await movement('MISC_INCOME', '999999999999999');
  expect((await service.summary(a, {})).cashReceived).toBe('9999999999999990');
  await movement('EXPENSE', '999999999999999');
  expect((await service.summary(a, {})).estimatedProfit).toBe(
    '8999999999999991',
  );
});
it('keeps correction history immutable and assigns reversal effects to correction period', async () => {
  const original = await movement('MISC_INCOME', '125', undefined, {
    occurredAt: time(-3600000),
  });
  const boundary = time(-60000);
  const reversed = await service.reverse(
    a,
    original.id,
    { reason: 'Correction sensitive note' },
    'reversal-request',
  );
  expect(reversed).toMatchObject({
    status: 'REVERSAL',
    reversalOf: original.id,
    amount: '125',
  });
  expect(await service.detail(a, original.id)).toMatchObject({
    status: 'REVERSED',
    reversedBy: reversed.id,
    amount: '125',
  });
  expect((await service.summary(a, { until: boundary })).recordedRevenue).toBe(
    '125',
  );
  expect(
    (await service.summary(a, { from: boundary, until: time(60000) }))
      .recordedRevenue,
  ).toBe('-125');
  expect(
    (await service.summary(a, { until: time(60000) })).recordedRevenue,
  ).toBe('0');
  await expect(
    service.reverse(a, original.id, { reason: 'again' }, 'duplicate'),
  ).rejects.toMatchObject({
    response: { code: 'COMMERCIAL_ALREADY_REVERSED' },
  });
  await expect(
    service.reverse(a, reversed.id, { reason: 'again' }, 'duplicate'),
  ).rejects.toMatchObject({
    response: { code: 'COMMERCIAL_REVERSAL_NOT_ALLOWED' },
  });
});
it('rejects excessive, backdated and reversal-induced negative deposits but permits refund correction', async () => {
  const r = await rental();
  const receipt = await movement('DEPOSIT_RECEIPT', '100', r.id, {
    occurredAt: time(-120000),
  });
  await expect(
    movement('DEPOSIT_REFUND', '1', r.id, { occurredAt: time(-180000) }),
  ).rejects.toMatchObject({
    response: { code: 'INSUFFICIENT_DEPOSIT_BALANCE' },
  });
  const refund = await movement('DEPOSIT_REFUND', '60', r.id);
  await expect(movement('DEPOSIT_RETAIN', '41', r.id)).rejects.toMatchObject({
    response: { code: 'INSUFFICIENT_DEPOSIT_BALANCE' },
  });
  await expect(
    service.reverse(a, receipt.id, { reason: 'No receipt' }, 'invalid'),
  ).rejects.toMatchObject({
    response: { code: 'INSUFFICIENT_DEPOSIT_BALANCE' },
  });
  await service.reverse(
    a,
    refund.id,
    { reason: 'Refund did not happen' },
    'correct',
  );
  await service.reverse(
    a,
    receipt.id,
    { reason: 'Receipt did not happen' },
    'correct',
  );
  expect((await service.summary(a, { until: time(60000) })).depositHeld).toBe(
    '0',
  );
});
it('keeps deposit held cumulative when period revenue has a lower bound', async () => {
  const r = await rental();
  await movement('DEPOSIT_RECEIPT', '100', r.id, {
    occurredAt: time(-3600000),
  });
  await movement('DEPOSIT_REFUND', '20', r.id, { occurredAt: time(-60000) });
  expect(
    await service.summary(a, { from: time(-120000), rentalId: r.id }),
  ).toMatchObject({
    depositHeld: '80',
    recordedRevenue: '0',
    cashReceived: '0',
  });
});
it('scopes all linked resources, reads, summary filters and corrections to the verified tenant', async () => {
  const own = await rental(),
    other = await rental(b);
  const record = await movement('RENTAL_PAYMENT', '10', own.id);
  expect(record.vehicleId).toBe(own.vehicleId);
  await expect(
    movement('RENTAL_PAYMENT', '10', other.id),
  ).rejects.toMatchObject({ response: { code: 'RENTAL_NOT_FOUND' } });
  await expect(
    movement('EXPENSE', '10', undefined, { vehicleId: other.vehicleId }),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
  await expect(service.detail(b, record.id)).rejects.toMatchObject({
    response: { code: 'COMMERCIAL_MOVEMENT_NOT_FOUND' },
  });
  await expect(
    service.reverse(b, record.id, { reason: 'forged' }, 'forged'),
  ).rejects.toMatchObject({
    response: { code: 'COMMERCIAL_MOVEMENT_NOT_FOUND' },
  });
  await expect(service.rentalSummary(b, own.id)).rejects.toMatchObject({
    response: { code: 'RENTAL_NOT_FOUND' },
  });
  await expect(service.summary(b, { rentalId: own.id })).rejects.toMatchObject({
    response: { code: 'RENTAL_NOT_FOUND' },
  });
  await expect(
    service.summary(b, { vehicleId: own.vehicleId }),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
  await expect(
    movement('EXPENSE', '10', own.id, { vehicleId: other.vehicleId }),
  ).rejects.toMatchObject({ response: { code: 'COMMERCIAL_SCOPE_MISMATCH' } });
  expect((await service.list(b, new CommercialMovementQuery())).data).toEqual(
    [],
  );
});
it('preserves terminal rental history and locks draft vehicle changes after any commercial record', async () => {
  const r = await rental(),
    other = await rental();
  await movement('RENTAL_PAYMENT', '10', r.id);
  await expect(
    rentalService.updateRental(
      a,
      r.id,
      { vehicleId: other.vehicleId },
      'change',
    ),
  ).rejects.toMatchObject({
    response: { code: 'RENTAL_HAS_COMMERCIAL_HISTORY' },
  });
  await db
    .update(schema.rentals)
    .set({ status: 'CANCELLED', cancelledAt: new Date() })
    .where(eq(schema.rentals.id, r.id));
  expect((await movement('EXPENSE', '5', r.id)).rentalId).toBe(r.id);
  expect((await service.rentalSummary(a, r.id)).recordedRentalPayments).toBe(
    '10',
  );
});
it.each(['membership', 'profile', 'business'])(
  'rechecks active %s under the business lock before changing financial data',
  async (scenario) => {
    const original = await movement('MISC_INCOME', '10');
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
    await expect(movement('MISC_INCOME', '20')).rejects.toMatchObject({
      response: { code: 'TENANT_ACCESS_DENIED' },
    });
    await expect(
      service.reverse(a, original.id, { reason: 'stale' }, 'stale'),
    ).rejects.toMatchObject({ response: { code: 'TENANT_ACCESS_DENIED' } });
  },
);
it('grants commercial permissions only to Owner and never to platform or deferred roles', async () => {
  expect(permissionsFor('OWNER')).toEqual(
    expect.arrayContaining(['commercial.read', 'commercial.manage']),
  );
  for (const role of [
    'PLATFORM_OPERATOR',
    'CUSTOMER',
    'ADMIN',
    'OPERATIONS',
    'unknown',
  ]) {
    expect(permissionsFor(role)).not.toContain('commercial.read');
    await expect(service.summary({ ...a, role }, {})).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  }
});
it('writes financial data and redacted audit atomically for both posting and reversal', async () => {
  const original = await movement('MISC_INCOME', '77', undefined, {
    notes: 'Private note',
    reference: 'Private reference',
  });
  const [audit] = await db
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.entityId, original.id));
  expect(audit.metadata).toEqual({
    requestId: 'fixture-request',
    fields: expect.arrayContaining(['amount', 'notes', 'reference']),
  });
  expect(JSON.stringify(audit.metadata)).not.toMatch(/Private|77/);
  await client.exec(
    "alter table audit_logs add constraint commercial_audit_failure check(action not in ('commercial.create','commercial.reverse')) not valid",
  );
  try {
    await expect(movement('MISC_INCOME', '25')).rejects.toBeDefined();
    await expect(
      service.reverse(a, original.id, { reason: 'Private reason' }, 'audit'),
    ).rejects.toBeDefined();
    expect((await service.detail(a, original.id)).status).toBe('POSTED');
    expect((await service.list(a, new CommercialMovementQuery())).total).toBe(
      1,
    );
    const [total] = await db
      .select({ total: count() })
      .from(schema.commercialMovements)
      .where(eq(schema.commercialMovements.businessId, a.businessId));
    expect(total.total).toBe(1);
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint commercial_audit_failure',
    );
  }
});
it('validates future dates, ranges and currency without writing data', async () => {
  await expect(
    movement('MISC_INCOME', '10', undefined, { occurredAt: time(60000) }),
  ).rejects.toMatchObject({ response: { code: 'INVALID_COMMERCIAL_DATE' } });
  await expect(
    service.summary(a, { from: time(60000), until: time(0) }),
  ).rejects.toMatchObject({ response: { code: 'INVALID_COMMERCIAL_RANGE' } });
  await db
    .update(schema.businesses)
    .set({ currency: 'USD' })
    .where(eq(schema.businesses.id, a.businessId));
  await expect(movement('MISC_INCOME', '10')).rejects.toMatchObject({
    response: { code: 'COMMERCIAL_CURRENCY_UNSUPPORTED' },
  });
  await expect(service.summary(a, {})).rejects.toMatchObject({
    response: { code: 'COMMERCIAL_CURRENCY_UNSUPPORTED' },
  });
});
it('supports literal search, stable pagination and status filtering including correction rows', async () => {
  const first = await movement('MISC_INCOME', '10', undefined, {
    reference: 'A_100',
    occurredAt: time(-120000),
  });
  await movement('MISC_INCOME', '20', undefined, { reference: 'AB100' });
  const q = Object.assign(new CommercialMovementQuery(), { search: 'A_100' });
  expect((await service.list(a, q)).data.map((row) => row.id)).toEqual([
    first.id,
  ]);
  const reverse = await service.reverse(
    a,
    first.id,
    { reason: 'Correction' },
    'reverse',
  );
  const until = time(60000);
  expect(
    (
      await service.list(
        a,
        Object.assign(new CommercialMovementQuery(), {
          status: 'REVERSED',
          until,
        }),
      )
    ).data.map((row) => row.id),
  ).toEqual([first.id]);
  expect(
    (
      await service.list(
        a,
        Object.assign(new CommercialMovementQuery(), {
          status: 'REVERSAL',
          until,
        }),
      )
    ).data.map((row) => row.id),
  ).toEqual([reverse.id]);
  const page = await service.list(
    a,
    Object.assign(new CommercialMovementQuery(), { limit: 1, page: 1, until }),
  );
  const next = await service.list(
    a,
    Object.assign(new CommercialMovementQuery(), { limit: 1, page: 2, until }),
  );
  expect(page.total).toBe(3);
  expect(page.data[0].id).not.toBe(next.data[0].id);
});

it('locks business currency after financial history while allowing same currency and ordinary metadata changes', async () => {
  const core = new CoreService({ db } as unknown as Database);
  await core.updateBusiness(a, { currency: 'USD' }, 'before');
  await core.updateBusiness(a, { currency: 'VND' }, 'before');
  await movement('MISC_INCOME', '10');
  await expect(
    core.updateBusiness(a, { currency: 'USD' }, 'change'),
  ).rejects.toMatchObject({
    response: { code: 'BUSINESS_HAS_COMMERCIAL_HISTORY' },
  });
  expect(
    (
      await core.updateBusiness(
        a,
        { currency: 'VND', name: 'Renamed' },
        'metadata',
      )
    ).currency,
  ).toBe('VND');
});
