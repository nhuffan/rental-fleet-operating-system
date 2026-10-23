import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Database } from '../database/database.js';
import type { TenantContext } from '../auth/guards.js';
import * as schema from '../database/schema.js';
import { CoreService } from './core.service.js';
import { MemberCreate, MemberUpdate, PageQuery } from './dto.js';

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let service: CoreService;
let owner: TenantContext;
async function identity() {
  const id = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [id]);
  return id;
}
beforeAll(async () => {
  client = new PGlite({ extensions: { btree_gist } });
  await client.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const file of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await client.exec(
      readFileSync('../../supabase/migrations/' + file, 'utf8'),
    );
  db = drizzle(client, { schema });
  service = new CoreService({ db } as unknown as Database);
}, 30000);
beforeEach(async () => {
  const [business] = await db
    .insert(schema.businesses)
    .values({ name: 'Owner workspace' })
    .returning();
  const userId = await identity();
  await db.insert(schema.profiles).values({ userId, displayName: 'Owner' });
  const [membership] = await db
    .insert(schema.memberships)
    .values({ userId, businessId: business.id, roleKey: 'OWNER' })
    .returning();
  owner = {
    userId,
    membershipId: membership.id,
    businessId: business.id,
    businessName: business.name,
    email: '',
    role: 'OWNER',
  };
});
afterAll(async () => {
  await client?.close();
});

it('accepts only an Auth user ID for creation and an explicit status for updates', async () => {
  const options = { whitelist: true, forbidNonWhitelisted: true };
  expect(
    await validate(
      plainToInstance(MemberCreate, { userId: randomUUID() }),
      options,
    ),
  ).toEqual([]);
  expect(
    await validate(
      plainToInstance(MemberUpdate, { status: 'DISABLED' }),
      options,
    ),
  ).toEqual([]);
  for (const roleKey of ['OWNER', 'ADMIN', 'OPERATIONS', 'CUSTOMER']) {
    expect(
      (
        await validate(
          plainToInstance(MemberCreate, { userId: randomUUID(), roleKey }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(MemberUpdate, { status: 'ACTIVE', roleKey }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  }
  expect(
    (await validate(plainToInstance(MemberUpdate, {}), options)).length,
  ).toBeGreaterThan(0);
});
it('creates only an Owner and records the fixed role in the atomic audit', async () => {
  const userId = await identity();
  const member = await service.addMember(owner, { userId }, 'owner-add');
  expect(member).toMatchObject({
    userId,
    businessId: owner.businessId,
    roleKey: 'OWNER',
    status: 'ACTIVE',
  });
  expect((await service.listMembers(owner, new PageQuery())).total).toBe(2);
  const audit = await db
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.entityId, member.id));
  expect(audit[0]).toMatchObject({
    action: 'membership.add',
    metadata: { requestId: 'owner-add', fields: ['userId', 'roleKey'] },
  });
});
it('preserves the last active Owner and excludes disabled profiles from that count', async () => {
  const other = await service.addMember(
    owner,
    { userId: await identity() },
    'other',
  );
  await db
    .update(schema.profiles)
    .set({ status: 'DISABLED' })
    .where(eq(schema.profiles.userId, other.userId));
  await expect(
    service.updateMember(
      owner,
      owner.membershipId,
      { status: 'DISABLED' },
      'last-owner',
    ),
  ).rejects.toMatchObject({ response: { code: 'LAST_OWNER' } });
  const [retained] = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.id, owner.membershipId));
  expect(retained.status).toBe('ACTIVE');
});
it('allows status management with another active Owner and rechecks revocation before writes', async () => {
  await service.addMember(owner, { userId: await identity() }, 'other');
  const disabled = await service.updateMember(
    owner,
    owner.membershipId,
    { status: 'DISABLED' },
    'disable',
  );
  expect(disabled).toMatchObject({ roleKey: 'OWNER', status: 'DISABLED' });
  await expect(
    service.addMember(owner, { userId: await identity() }, 'stale'),
  ).rejects.toMatchObject({ response: { code: 'TENANT_ACCESS_DENIED' } });
});
it('rolls back membership and profile creation when the audit cannot be written', async () => {
  const userId = await identity();
  await client.exec(
    "alter table audit_logs add constraint membership_audit_failure check(action <> 'membership.add') not valid",
  );
  try {
    await expect(
      service.addMember(owner, { userId }, 'failed-audit'),
    ).rejects.toBeDefined();
    expect(
      await db
        .select()
        .from(schema.memberships)
        .where(eq(schema.memberships.userId, userId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, userId)),
    ).toEqual([]);
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint membership_audit_failure',
    );
  }
});
