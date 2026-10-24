import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { and, count, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Database } from '../database/database.js';
import * as schema from '../database/schema.js';
import type { TenantContext } from '../auth/guards.js';
import { FleetService } from '../fleet/vehicles/fleet.service.js';
import { RentalService } from './rental.service.js';
import type { RentalInspectionInput } from './dto.js';
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let service: RentalService;
let fleet: FleetService;
let a: TenantContext;
let b: TenantContext;
const inspection = (
  extra: Partial<RentalInspectionInput> = {},
): RentalInspectionInput => ({
  fuelPercent: 80,
  exteriorCondition: 'GOOD',
  interiorCondition: 'GOOD',
  spareTire: 'PRESENT',
  tools: 'NOT_APPLICABLE',
  registrationDocument: 'PRESENT',
  insuranceDocument: 'PRESENT',
  keys: 'PRESENT',
  damageNotes: '',
  notes: '',
  ...extra,
});
async function actor(name: string): Promise<TenantContext> {
  const [business] = await db
    .insert(schema.businesses)
    .values({ name })
    .returning();
  const userId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db
    .insert(schema.profiles)
    .values({ userId, displayName: 'Inspection fixture' });
  const [membership] = await db
    .insert(schema.memberships)
    .values({ businessId: business.id, userId, roleKey: 'OWNER' })
    .returning();
  return {
    userId,
    email: 'inspection@example.test',
    businessId: business.id,
    businessName: name,
    membershipId: membership.id,
    role: 'OWNER',
  };
}
async function rental() {
  const customer = await service.createCustomer(
    a,
    { name: 'Inspection fixture', phone: '12345' },
    'customer',
  );
  const vehicle = await fleet.createVehicle(
    a,
    {
      licensePlate:
        'I' + randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
      make: 'QA',
      model: 'Inspection',
    },
    'vehicle',
  );
  const draft = await service.createRental(
    a,
    {
      customerId: customer.id,
      vehicleId: vehicle.id,
      startAt: new Date(Date.now() - 60000).toISOString(),
      endAt: new Date(Date.now() + 3600000).toISOString(),
    },
    'draft',
  );
  await service.reserve(a, draft.id, 'reserve');
  return draft;
}
async function records(id: string) {
  return db
    .select()
    .from(schema.rentalInspections)
    .where(
      and(
        eq(schema.rentalInspections.businessId, a.businessId),
        eq(schema.rentalInspections.rentalId, id),
      ),
    );
}
async function auditCount(id: string) {
  return (
    await db
      .select({ n: count() })
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.businessId, a.businessId),
          eq(schema.auditLogs.entityId, id),
        ),
      )
  )[0].n;
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
  a = await actor('Inspection A');
  b = await actor('Inspection B');
});
afterAll(async () => {
  await client?.close();
});
it('stores two server-attributed milestones and latest vehicle history without financial side effects', async () => {
  const r = await rental();
  const handed = await service.handover(
    a,
    r.id,
    {
      odometerStart: 1000,
      inspection: inspection({ notes: 'Private handover' }),
    },
    'handover',
  );
  const returned = await service.returnRental(
    a,
    r.id,
    {
      odometerEnd: 1120,
      inspection: inspection({
        fuelPercent: 65,
        exteriorCondition: 'DAMAGED',
        damageNotes: 'Private scratch',
        keys: 'MISSING',
      }),
    },
    'return',
  );
  const result = await service.rentalInspections(a, r.id);
  expect(result).toMatchObject({ rentalId: r.id, vehicleId: r.vehicleId });
  expect(result.data).toHaveLength(2);
  expect(result.data.map((x) => x.type).sort()).toEqual(['HANDOVER', 'RETURN']);
  const start = result.data.find((x) => x.type === 'HANDOVER')!;
  const end = result.data.find((x) => x.type === 'RETURN')!;
  expect(start).toMatchObject({
    businessId: a.businessId,
    rentalId: r.id,
    vehicleId: r.vehicleId,
    actorId: a.userId,
    odometer: 1000,
    fuelPercent: 80,
  });
  expect(start.recordedAt).toEqual(handed.handedOverAt);
  expect(end.recordedAt).toEqual(returned.returnedAt);
  expect(end.odometer - start.odometer).toBe(120);
  expect(end.fuelPercent - start.fuelPercent).toBe(-15);
  expect(
    (await service.vehicleLatestInspection(a, r.vehicleId)).inspection?.id,
  ).toBe(end.id);
  const movements = await db
    .select({ n: count() })
    .from(schema.commercialMovements)
    .where(eq(schema.commercialMovements.businessId, a.businessId));
  expect(movements[0].n).toBe(0);
  const audit = await db
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.businessId, a.businessId));
  expect(JSON.stringify(audit)).not.toContain('Private scratch');
  expect(JSON.stringify(audit)).not.toContain('Private handover');
});
it('rejects invalid inspection and lower return odometer without state, snapshot or audit changes', async () => {
  const r = await rental();
  const before = await auditCount(r.id);
  await expect(
    service.handover(
      a,
      r.id,
      {
        odometerStart: 100,
        inspection: inspection({
          exteriorCondition: 'DAMAGED',
          damageNotes: ' ',
        }),
      },
      'invalid',
    ),
  ).rejects.toMatchObject({ response: { code: 'INVALID_INSPECTION' } });
  expect((await service.rental(a, r.id)).status).toBe('RESERVED');
  expect(await records(r.id)).toHaveLength(0);
  expect(await auditCount(r.id)).toBe(before);
  await service.handover(
    a,
    r.id,
    { odometerStart: 100, inspection: inspection() },
    'handover',
  );
  const after = await auditCount(r.id);
  await expect(
    service.returnRental(
      a,
      r.id,
      { odometerEnd: 99, inspection: inspection() },
      'lower',
    ),
  ).rejects.toMatchObject({ response: { code: 'INVALID_ODOMETER' } });
  expect((await service.rental(a, r.id)).status).toBe('ACTIVE');
  expect(await records(r.id)).toHaveLength(1);
  expect(await auditCount(r.id)).toBe(after);
});
it('rolls back snapshot, milestone and audit together if inspection insertion fails', async () => {
  const r = await rental();
  const before = await auditCount(r.id);
  await client.exec(
    "alter table rental_inspections add constraint inspection_test_failure check(notes <> 'reject-this-fixture') not valid",
  );
  try {
    await expect(
      service.handover(
        a,
        r.id,
        {
          odometerStart: 100,
          inspection: inspection({ notes: 'reject-this-fixture' }),
        },
        'failed',
      ),
    ).rejects.toBeDefined();
    expect((await service.rental(a, r.id)).status).toBe('RESERVED');
    expect(await records(r.id)).toHaveLength(0);
    expect(await auditCount(r.id)).toBe(before);
  } finally {
    await client.exec(
      'alter table rental_inspections drop constraint inspection_test_failure',
    );
  }
});
it.each(['handover', 'return'] as const)(
  'rolls back the %s inspection and lifecycle when audit fails',
  async (phase) => {
    const r = await rental();
    if (phase === 'return')
      await service.handover(
        a,
        r.id,
        { odometerStart: 100, inspection: inspection() },
        'handover',
      );
    const before = await auditCount(r.id);
    await client.exec(
      `alter table audit_logs add constraint inspection_audit_failure check(action <> 'rental.${phase}') not valid`,
    );
    try {
      const operation =
        phase === 'handover'
          ? service.handover(
              a,
              r.id,
              { odometerStart: 100, inspection: inspection() },
              'failed',
            )
          : service.returnRental(
              a,
              r.id,
              { odometerEnd: 110, inspection: inspection() },
              'failed',
            );
      await expect(operation).rejects.toBeDefined();
      expect((await service.rental(a, r.id)).status).toBe(
        phase === 'handover' ? 'RESERVED' : 'ACTIVE',
      );
      expect(await records(r.id)).toHaveLength(phase === 'handover' ? 0 : 1);
      expect(await auditCount(r.id)).toBe(before);
    } finally {
      await client.exec(
        'alter table audit_logs drop constraint inspection_audit_failure',
      );
    }
  },
);
it('serializes competing submissions into one milestone and one audit per action', async () => {
  const r = await rental();
  const before = await auditCount(r.id);
  for (const phase of ['handover', 'return'] as const) {
    const write = () =>
      phase === 'handover'
        ? service.handover(
            a,
            r.id,
            { odometerStart: 100, inspection: inspection() },
            'race',
          )
        : service.returnRental(
            a,
            r.id,
            { odometerEnd: 100, inspection: inspection() },
            'race',
          );
    const outcomes = await Promise.allSettled([write(), write()]);
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const failed = outcomes.find(
      (x) => x.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({
      response: { code: 'INVALID_RENTAL_STATE' },
    });
  }
  expect(await records(r.id)).toHaveLength(2);
  expect(await auditCount(r.id)).toBe(before + 2);
});
it('does not expose or transition known rental/vehicle IDs from another tenant', async () => {
  const r = await rental();
  await expect(service.rentalInspections(b, r.id)).rejects.toMatchObject({
    response: { code: 'RENTAL_NOT_FOUND' },
  });
  await expect(
    service.vehicleLatestInspection(b, r.vehicleId),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
  await expect(
    service.handover(
      b,
      r.id,
      { odometerStart: 1, inspection: inspection() },
      'foreign',
    ),
  ).rejects.toMatchObject({ response: { code: 'RENTAL_NOT_FOUND' } });
  expect(await records(r.id)).toHaveLength(0);
});
it.each(['membership', 'profile', 'business'] as const)(
  'rechecks active %s under the lock before both inspection milestones',
  async (target) => {
    for (const phase of ['handover', 'return'] as const) {
      const r = await rental();
      if (phase === 'return')
        await service.handover(
          a,
          r.id,
          { odometerStart: 100, inspection: inspection() },
          'handover',
        );
      const table =
        target === 'membership'
          ? schema.memberships
          : target === 'profile'
            ? schema.profiles
            : schema.businesses;
      const column =
        target === 'membership'
          ? schema.memberships.id
          : target === 'profile'
            ? schema.profiles.userId
            : schema.businesses.id;
      const id =
        target === 'membership'
          ? a.membershipId
          : target === 'profile'
            ? a.userId
            : a.businessId;
      await db.update(table).set({ status: 'DISABLED' }).where(eq(column, id));
      const before = await auditCount(r.id);
      try {
        const operation =
          phase === 'handover'
            ? service.handover(
                a,
                r.id,
                { odometerStart: 100, inspection: inspection() },
                'revoked',
              )
            : service.returnRental(
                a,
                r.id,
                { odometerEnd: 101, inspection: inspection() },
                'revoked',
              );
        await expect(operation).rejects.toMatchObject({
          response: { code: 'TENANT_ACCESS_DENIED' },
        });
        expect(await records(r.id)).toHaveLength(phase === 'handover' ? 0 : 1);
        expect(await auditCount(r.id)).toBe(before);
      } finally {
        await db.update(table).set({ status: 'ACTIVE' }).where(eq(column, id));
      }
      if (phase === 'handover') await service.cancel(a, r.id, {}, 'release');
    }
  },
);
it('keeps historical rentals readable without fabricated handover snapshots', async () => {
  const r = await rental();
  const now = new Date();
  await db
    .update(schema.rentals)
    .set({ status: 'ACTIVE', handedOverAt: now, odometerStart: 500 })
    .where(eq(schema.rentals.id, r.id));
  expect((await service.rentalInspections(a, r.id)).data).toEqual([]);
  expect(
    (await service.vehicleLatestInspection(a, r.vehicleId)).inspection,
  ).toBeNull();
  await service.returnRental(
    a,
    r.id,
    { odometerEnd: 500, inspection: inspection() },
    'legacy-return',
  );
  expect((await service.rental(a, r.id)).status).toBe('COMPLETED');
  expect(
    (await service.rentalInspections(a, r.id)).data.map((x) => x.type),
  ).toEqual(['RETURN']);
  const old = await rental();
  const oldTime = new Date();
  await db
    .update(schema.rentals)
    .set({
      status: 'COMPLETED',
      handedOverAt: oldTime,
      returnedAt: oldTime,
      odometerStart: 0,
      odometerEnd: 0,
    })
    .where(eq(schema.rentals.id, old.id));
  expect((await service.rentalInspections(a, old.id)).data).toEqual([]);
});
