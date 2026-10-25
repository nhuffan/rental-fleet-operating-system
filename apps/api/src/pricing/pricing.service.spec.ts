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
import { PricingController } from './pricing.controller.js';
import { PricingService, resolveRentalPricing } from './pricing.service.js';
import {
  QuotePreviewInput,
  RateCardQuery,
  type RateCardCreate,
} from './dto.js';
let client: PGlite,
  db: ReturnType<typeof drizzle<typeof schema>>,
  service: PricingService;
let owner: TenantContext,
  foreign: TenantContext,
  vehicleId: string,
  foreignVehicleId: string;
const startAt = '2030-02-01T09:00:00+07:00',
  endAt = '2030-02-02T11:00:01+07:00';
async function actor(name: string): Promise<TenantContext> {
  const [business] = await db
    .insert(schema.businesses)
    .values({ name })
    .returning();
  const userId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db.insert(schema.profiles).values({ userId, displayName: name });
  const [member] = await db
    .insert(schema.memberships)
    .values({ businessId: business.id, userId, roleKey: 'OWNER' })
    .returning();
  return {
    businessId: business.id,
    businessName: name,
    userId,
    membershipId: member.id,
    email: 'synthetic@example.test',
    role: 'OWNER',
  };
}
function rate(extra: Partial<RateCardCreate> = {}): RateCardCreate {
  return {
    name: 'Daily price',
    vehicleId,
    hourlyRate: '150000',
    dailyRate: '800000',
    minimumCharge: '0',
    extraHourRate: '100000',
    effectiveFrom: '2030-01-01T00:00:00+07:00',
    effectiveUntil: null,
    ...extra,
  };
}
function input(extra: Partial<QuotePreviewInput> = {}): QuotePreviewInput {
  return { vehicleId, startAt, endAt, timeZone: 'Asia/Ho_Chi_Minh', ...extra };
}
function resolve(selection: Parameters<typeof resolveRentalPricing>[3]) {
  return db.transaction((tx) =>
    resolveRentalPricing(
      tx as unknown as Parameters<typeof resolveRentalPricing>[0],
      owner,
      { vehicleId, startAt, endAt },
      selection,
    ),
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
  service = new PricingService({ db } as unknown as Database);
}, 30000);
beforeEach(async () => {
  owner = await actor('Pricing Owner');
  foreign = await actor('Other Owner');
  const [vehicle] = await db
    .insert(schema.vehicles)
    .values({
      businessId: owner.businessId,
      licensePlate: '51A12345',
      make: 'Synthetic',
      model: 'Fixture',
    })
    .returning();
  vehicleId = vehicle.id;
  const [other] = await db
    .insert(schema.vehicles)
    .values({
      businessId: foreign.businessId,
      licensePlate: '51A12345',
      make: 'Synthetic',
      model: 'Fixture',
    })
    .returning();
  foreignVehicleId = other.id;
});
afterAll(async () => client?.close());
it('returns a mutation-free missing-rate state and requires a reasoned explicit manual agreement', async () => {
  const preview = await service.preview(owner, input());
  expect(preview).toMatchObject({
    available: false,
    reason: 'NO_RATE',
    totalAmount: null,
    breakdown: null,
  });
  expect(preview.quoteHash).toMatch(/^[a-f0-9]{64}$/);
  await expect(
    resolve({ expectedQuoteHash: preview.quoteHash }),
  ).rejects.toMatchObject({
    response: { code: 'PRICING_MANUAL_AMOUNT_REQUIRED' },
  });
  await expect(
    resolve({ expectedQuoteHash: preview.quoteHash, overrideAmount: '500000' }),
  ).rejects.toMatchObject({ response: { code: 'PRICING_REASON_REQUIRED' } });
  const manual = await resolve({
    expectedQuoteHash: preview.quoteHash,
    overrideAmount: '500000',
    overrideReason: 'Agreed with customer',
  });
  expect(manual).toMatchObject({
    agreedAmount: '500000',
    mode: 'MANUAL',
    overrideReason: 'Agreed with customer',
  });
  expect(
    (await db.select({ n: count() }).from(schema.rentalRateCards))[0].n,
  ).toBe(0);
  expect(
    (await db.select({ n: count() }).from(schema.commercialMovements))[0].n,
  ).toBe(0);
  await service.create(owner, rate(), 'create');
  await expect(
    resolve({
      expectedQuoteHash: preview.quoteHash,
      overrideAmount: '500000',
      overrideReason: 'Agreed',
    }),
  ).rejects.toMatchObject({ response: { code: 'PRICING_PREVIEW_CHANGED' } });
});
it('prioritizes the vehicle card, uses explicit billing and fingerprints version/schedule changes', async () => {
  const fallback = await service.create(
    owner,
    rate({ vehicleId: null, dailyRate: '600000', extraHourRate: null }),
    'fallback',
  );
  const before = await service.preview(owner, input());
  expect(before.rate?.id).toBe(fallback.id);
  expect(before.totalAmount).toBe('1200000');
  const specific = await service.create(owner, rate(), 'vehicle');
  const preview = await service.preview(owner, input());
  expect(preview.rate?.id).toBe(specific.id);
  expect(preview.totalAmount).toBe('1100000');
  const calculated = await resolve({ expectedQuoteHash: preview.quoteHash });
  expect(calculated).toMatchObject({
    mode: 'CALCULATED',
    agreedAmount: '1100000',
  });
  const override = await resolve({
    expectedQuoteHash: preview.quoteHash,
    overrideAmount: '900000',
    overrideReason: 'Approved negotiated price',
  });
  expect(override.mode).toBe('OVERRIDE');
  const hourly = await service.preview(owner, input({ billingMode: 'HOURLY' }));
  expect(hourly.totalAmount).toBe('4050000');
  await service.update(
    owner,
    specific.id,
    Object.assign(rate(), { dailyRate: '900000', version: specific.version }),
    'update',
  );
  await expect(
    resolve({ expectedQuoteHash: preview.quoteHash }),
  ).rejects.toMatchObject({ response: { code: 'PRICING_PREVIEW_CHANGED' } });
  expect((await service.list(owner, new RateCardQuery())).data).toHaveLength(2);
  expect(
    (
      await service.list(
        owner,
        Object.assign(new RateCardQuery(), { scope: 'VEHICLE' }),
      )
    ).data,
  ).toHaveLength(1);
});
it('does not invent an hourly quote from a daily-only vehicle card or fall through to another scope', async () => {
  await service.create(owner, rate({ vehicleId: null }), 'fallback');
  await service.create(owner, rate({ hourlyRate: null }), 'vehicle');
  expect(
    await service.preview(owner, input({ billingMode: 'HOURLY' })),
  ).toMatchObject({
    available: false,
    reason: 'BILLING_MODE_UNAVAILABLE',
    totalAmount: null,
    rate: { scope: 'VEHICLE' },
  });
});
it('enforces half-open active overlap, optimistic writes, tenant resources and inactive card behavior', async () => {
  const first = await service.create(
    owner,
    rate({ effectiveUntil: '2030-02-01T00:00:00+07:00' }),
    'first',
  );
  const next = await service.create(
    owner,
    rate({ effectiveFrom: '2030-02-01T00:00:00+07:00' }),
    'next',
  );
  expect(next.id).not.toBe(first.id);
  await expect(service.create(owner, rate(), 'overlap')).rejects.toMatchObject({
    response: { code: 'RATE_OVERLAP' },
  });
  await service.create(owner, rate({ status: 'INACTIVE' }), 'inactive');
  await expect(
    service.update(
      owner,
      next.id,
      Object.assign(rate(), { version: 100 }),
      'stale',
    ),
  ).rejects.toMatchObject({ response: { code: 'RATE_VERSION_CHANGED' } });
  await expect(service.detail(foreign, next.id)).rejects.toMatchObject({
    response: { code: 'RATE_NOT_FOUND' },
  });
  await expect(
    service.create(owner, rate({ vehicleId: foreignVehicleId }), 'foreign'),
  ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
  await expect(service.preview(foreign, input())).rejects.toMatchObject({
    response: { code: 'VEHICLE_NOT_FOUND' },
  });
  await expect(
    service.delete(owner, next.id, { version: 100 }, 'stale'),
  ).rejects.toMatchObject({ response: { code: 'RATE_VERSION_CHANGED' } });
  expect(
    await service.delete(owner, next.id, { version: next.version }, 'delete'),
  ).toEqual({ deleted: true });
});
it('rechecks active Owner/profile/business and VND under the same tenant lock, with no metadata grants', async () => {
  const forged = {
    ...owner,
    membershipId: foreign.membershipId,
    role: 'OWNER',
  };
  await expect(service.create(forged, rate(), 'forged')).rejects.toMatchObject({
    response: { code: 'TENANT_ACCESS_DENIED' },
  });
  await db
    .update(schema.memberships)
    .set({ status: 'DISABLED' })
    .where(eq(schema.memberships.id, owner.membershipId));
  await expect(service.preview(owner, input())).rejects.toMatchObject({
    response: { code: 'TENANT_ACCESS_DENIED' },
  });
  await db
    .update(schema.memberships)
    .set({ status: 'ACTIVE' })
    .where(eq(schema.memberships.id, owner.membershipId));
  await db
    .update(schema.businesses)
    .set({ currency: 'USD' })
    .where(eq(schema.businesses.id, owner.businessId));
  await expect(service.create(owner, rate(), 'currency')).rejects.toMatchObject(
    { response: { code: 'PRICING_CURRENCY_UNSUPPORTED' } },
  );
  for (const [method, expected] of [
    ['create', 'rental.manage'],
    ['update', 'rental.manage'],
    ['delete', 'rental.manage'],
    ['preview', 'rental.read'],
  ] as const) {
    const handler = Object.getOwnPropertyDescriptor(
      PricingController.prototype,
      method,
    )?.value as object;
    expect(Reflect.getMetadata('permission', handler)).toBe(expected);
  }
});
it('rolls the rate write back when the atomic redacted audit fails', async () => {
  await client.exec(
    "create function public.reject_pricing_audit_test() returns trigger language plpgsql as $$ begin if new.action='rental_rate.create' then raise exception 'synthetic audit failure'; end if; return new; end $$; create trigger reject_pricing_audit_test before insert on public.audit_logs for each row execute function public.reject_pricing_audit_test();",
  );
  try {
    await expect(service.create(owner, rate(), 'rollback')).rejects.toThrow();
  } finally {
    await client.exec(
      'drop trigger reject_pricing_audit_test on public.audit_logs; drop function public.reject_pricing_audit_test();',
    );
  }
  expect((await service.list(owner, new RateCardQuery())).total).toBe(0);
});
