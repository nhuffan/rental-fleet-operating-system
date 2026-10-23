import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { randomUUID } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import type { Database } from '../database/database.js';
import { TenantGuard } from './guards.js';

let client: PGlite;
let guard: TenantGuard;
const request = (userId: string, businessId?: string) => {
  const value = {
    identity: { id: userId, email: '' },
    headers: businessId ? { 'x-business-id': businessId } : {},
  };
  return {
    value,
    context: {
      switchToHttp: () => ({ getRequest: () => value }),
    } as unknown as ExecutionContext,
  };
};
beforeAll(async () => {
  client = new PGlite();
  // Deliberately omit the role constraint to prove the API fails closed on
  // legacy/corrupt data independently of the owner-only schema migration.
  await client.exec(
    'create table user_profiles(user_id uuid primary key,status text);create table businesses(id uuid primary key,name text,status text);create table business_memberships(id uuid primary key,user_id uuid,business_id uuid,role_key text,status text,created_at timestamptz default now());',
  );
  guard = new TenantGuard({ db: drizzle(client) } as unknown as Database);
});
afterAll(async () => {
  await client?.close();
});
it.each(['ADMIN', 'OPERATIONS', 'CUSTOMER', 'PLATFORM_OPERATOR'])(
  'denies %s memberships for both explicit and default workspace selection',
  async (role) => {
    const userId = randomUUID(),
      businessId = randomUUID();
    await client.query("insert into user_profiles values($1,'ACTIVE')", [
      userId,
    ]);
    await client.query(
      "insert into businesses values($1,'Workspace','ACTIVE')",
      [businessId],
    );
    await client.query(
      "insert into business_memberships(id,user_id,business_id,role_key,status) values($1,$2,$3,$4,'ACTIVE')",
      [randomUUID(), userId, businessId, role],
    );
    for (const selected of [undefined, businessId])
      await expect(
        guard.canActivate(request(userId, selected).context),
      ).rejects.toMatchObject({ response: { code: 'TENANT_ACCESS_DENIED' } });
  },
);
it('selects an active Owner workspace even when an older legacy membership exists', async () => {
  const userId = randomUUID(),
    legacyBusiness = randomUUID(),
    ownerBusiness = randomUUID();
  await client.query("insert into user_profiles values($1,'ACTIVE')", [userId]);
  await client.query(
    "insert into businesses values($1,'Legacy','ACTIVE'),($2,'Owner workspace','ACTIVE')",
    [legacyBusiness, ownerBusiness],
  );
  await client.query(
    "insert into business_memberships(id,user_id,business_id,role_key,status,created_at) values($1,$2,$3,'ADMIN','ACTIVE','2020-01-01'),($4,$2,$5,'OWNER','ACTIVE','2021-01-01')",
    [randomUUID(), userId, legacyBusiness, randomUUID(), ownerBusiness],
  );
  const req = request(userId);
  expect(await guard.canActivate(req.context)).toBe(true);
  expect(req.value).toMatchObject({
    tenant: { businessId: ownerBusiness, role: 'OWNER' },
  });
});
