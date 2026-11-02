import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { count, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Reflector } from '@nestjs/core';
import type { Database } from '../database/database.js';
import * as schema from '../database/schema.js';
import type { TenantContext } from '../auth/guards.js';
import { ContractService, contractContentHash } from './contract.service.js';
import { ContractController } from './contract.controller.js';
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let service: ContractService;
let owner: TenantContext;
let foreign: TenantContext;
async function actor(name: string): Promise<TenantContext> {
  const [business] = await db
    .insert(schema.businesses)
    .values({ name })
    .returning();
  const userId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db.insert(schema.profiles).values({ userId, displayName: 'Fixture' });
  const [member] = await db
    .insert(schema.memberships)
    .values({ businessId: business.id, userId, roleKey: 'OWNER' })
    .returning();
  return {
    userId,
    email: 'contract-fixture@example.test',
    businessId: business.id,
    businessName: name,
    membershipId: member.id,
    role: 'OWNER',
  };
}
async function rental(status = 'RESERVED') {
  const [customer] = await db
    .insert(schema.customers)
    .values({
      businessId: owner.businessId,
      name: 'Fixture customer',
      phone: '0900000000',
      idNumber: '012345678901',
      driverLicenseNumber: 'GPLX012345',
    })
    .returning();
  const [vehicle] = await db
    .insert(schema.vehicles)
    .values({
      businessId: owner.businessId,
      licensePlate:
        'DOC' + randomUUID().replaceAll('-', '').slice(0, 9).toUpperCase(),
      make: 'QA',
      model: 'Document',
    })
    .returning();
  const now = Date.now();
  const [r] = await db
    .insert(schema.rentals)
    .values({
      businessId: owner.businessId,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startAt: new Date(now + 3600000),
      endAt: new Date(now + 7200000),
      rentalAmount: '1000000.00',
      depositRequiredAmount: '2000000.00',
      status,
      reservedAt: status === 'RESERVED' ? new Date(now) : null,
      cancelledAt: status === 'CANCELLED' ? new Date(now) : null,
    })
    .returning();
  return { r, customer, vehicle };
}
beforeAll(async () => {
  client = new PGlite({ extensions: { btree_gist } });
  await client.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const f of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await client.exec(readFileSync('../../supabase/migrations/' + f, 'utf8'));
  db = drizzle(client, { schema });
  service = new ContractService({ db } as unknown as Database);
}, 30000);
beforeEach(async () => {
  await client.exec(
    'truncate public.businesses,public.user_profiles,auth.users cascade',
  );
  owner = await actor('Owner tenant');
  foreign = await actor('Other tenant');
});
afterAll(async () => client?.close());
it('issues a missing-profile contract, uses exact strings and returns the unchanged immutable version idempotently', async () => {
  const { r } = await rental();
  const issued = await service.issue(owner, r.id, 'issue');
  expect(issued.created).toBe(true);
  expect(issued.document).toMatchObject({
    seq: 1,
    version: 1,
    rentalId: r.id,
    snapshot: {
      schemaVersion: 1,
      rental: { rentalAmount: '1000000', depositRequiredAmount: '2000000' },
      customer: { idNumber: '012345678901', driverLicenseNumber: 'GPLX012345' },
    },
  });
  expect(issued.document.docNumber).toMatch(/^HD-\d{4}-000001$/);
  expect(issued.document.snapshot.missing).toContain(
    'Tên pháp lý doanh nghiệp',
  );
  expect(issued.document.snapshot.terms).toContain('10.');
  expect(contractContentHash(issued.document.snapshot)).toBe(
    issued.document.contentHash,
  );
  expect((await service.issue(owner, r.id, 'repeat')).created).toBe(false);
  const list = await service.list(owner, r.id);
  expect(list).toMatchObject({
    latest: issued.document,
    versionCount: 1,
    dataChanged: false,
  });
  expect(
    (await db.select({ n: count() }).from(schema.commercialMovements))[0].n,
  ).toBe(0);
  const audit = await db.select().from(schema.auditLogs);
  expect(audit).toHaveLength(1);
  expect(JSON.stringify(audit[0].metadata)).not.toMatch(
    /012345678901|GPLX012345|contract-fixture@example/,
  );
});
it('preserves old versions while source details and terms change; hashes use canonical key ordering', async () => {
  const { r, customer } = await rental();
  const first = await service.issue(owner, r.id, 'first');
  await db
    .update(schema.businesses)
    .set({ legalName: 'Updated legal name', contractTerms: 'Updated terms' })
    .where(eq(schema.businesses.id, owner.businessId));
  await db
    .update(schema.customers)
    .set({ idNumber: 'NEW-ID' })
    .where(eq(schema.customers.id, customer.id));
  expect((await service.list(owner, r.id)).dataChanged).toBe(true);
  const second = await service.issue(owner, r.id, 'second');
  expect(second.document).toMatchObject({
    version: 2,
    seq: 2,
    snapshot: { terms: 'Updated terms', customer: { idNumber: 'NEW-ID' } },
  });
  expect(await service.version(owner, r.id, 1)).toEqual(first.document);
  expect(second.document.contentHash).not.toBe(first.document.contentHash);
  const reversed = Object.fromEntries(
    Object.entries(first.document.snapshot).reverse(),
  );
  expect(
    contractContentHash(reversed as unknown as typeof first.document.snapshot),
  ).toBe(first.document.contentHash);
});
it.each(['DRAFT', 'CANCELLED'])(
  'blocks issuance from %s and never inserts a document',
  async (status) => {
    const { r } = await rental(status);
    await expect(service.issue(owner, r.id, 'blocked')).rejects.toMatchObject({
      response: { code: 'CONTRACT_NOT_READY' },
    });
    expect((await service.list(owner, r.id)).latest).toBeNull();
  },
);
it('isolates every read/write by tenant and denies a revoked active-context write', async () => {
  const { r } = await rental();
  await service.issue(owner, r.id, 'initial');
  for (const operation of [
    () => service.list(foreign, r.id),
    () => service.version(foreign, r.id, 1),
    () => service.issue(foreign, r.id, 'foreign'),
  ])
    await expect(operation()).rejects.toMatchObject({ status: 404 });
  await db
    .update(schema.memberships)
    .set({ status: 'DISABLED' })
    .where(eq(schema.memberships.id, owner.membershipId));
  for (const operation of [
    () => service.list(owner, r.id),
    () => service.version(owner, r.id, 1),
    () => service.issue(owner, r.id, 'revoked'),
  ])
    await expect(operation()).rejects.toMatchObject({
      response: { code: 'TENANT_ACCESS_DENIED' },
    });
});
it('rolls back the new document and numbering when audit insertion fails', async () => {
  const { r } = await rental();
  await client.exec(
    "alter table audit_logs add constraint contract_audit_failure check(action<>'rental.contract.issue') not valid",
  );
  try {
    await expect(service.issue(owner, r.id, 'rollback')).rejects.toBeDefined();
    expect((await service.list(owner, r.id)).versionCount).toBe(0);
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint contract_audit_failure',
    );
  }
  expect((await service.issue(owner, r.id, 'recovered')).document.seq).toBe(1);
});
it('serializes concurrent issuance without duplicate business numbers and protects endpoint permissions', async () => {
  const first = await rental(),
    second = await rental();
  const results = await Promise.all([
    service.issue(owner, first.r.id, 'parallel-a'),
    service.issue(owner, second.r.id, 'parallel-b'),
  ]);
  expect(results.map((r) => r.document.seq).sort((a, b) => a - b)).toEqual([
    1, 2,
  ]);
  expect(
    new Reflector().get(
      'permission',
      Reflect.get(ContractController.prototype, 'issue'),
    ),
  ).toBe('rental.manage');
  expect(
    new Reflector().get(
      'permission',
      Reflect.get(ContractController.prototype, 'list'),
    ),
  ).toBe('rental.read');
  expect(
    new Reflector().get(
      'permission',
      Reflect.get(ContractController.prototype, 'version'),
    ),
  ).toBe('rental.read');
});
it('preserves fractional legacy money rather than silently changing its amount', async () => {
  const { r } = await rental();
  await db
    .update(schema.rentals)
    .set({ rentalAmount: '125.55' })
    .where(eq(schema.rentals.id, r.id));
  expect(
    (await service.issue(owner, r.id, 'legacy')).document.snapshot.rental
      .rentalAmount,
  ).toBe('125.55');
});

it('deduplicates concurrent retries for the same rental without consuming another document number', async () => {
  const { r } = await rental();
  const results = await Promise.all([
    service.issue(owner, r.id, 'retry-a'),
    service.issue(owner, r.id, 'retry-b'),
  ]);
  expect(results.filter((result) => result.created)).toHaveLength(1);
  expect(new Set(results.map((result) => result.document.id)).size).toBe(1);
  expect((await service.list(owner, r.id)).versionCount).toBe(1);
});
