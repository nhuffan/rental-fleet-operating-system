import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { Database } from '../database/database.js';
import * as schema from '../database/schema.js';
import { CoreService } from '../core/core.service.js';
import { TenantGuard } from '../auth/guards.js';
import { AuthAdminService } from './auth-admin.service.js';
import { PlatformService } from './platform.service.js';
import { PlatformController } from './platform.controller.js';
import { PlatformGuard, type PlatformContext } from './guards.js';
import { PlatformBusinessCreate } from './dto.js';
let db: PGlite,
  database: Database,
  service: PlatformService,
  operator: PlatformContext,
  owner: string;
let created: ReturnType<typeof vi.fn>,
  issued: ReturnType<typeof vi.fn>,
  deleted: ReturnType<typeof vi.fn>;
const hash = 'a'.repeat(64),
  rid = () => randomUUID();
const input = () =>
  plainToInstance(PlatformBusinessCreate, {
    name: 'New business',
    ownerEmail: 'new@example.test',
    ownerDisplayName: 'New Owner',
  });
const context = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => {},
    getClass: () => class {},
  }) as unknown as ExecutionContext;
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create unique index users_email_unique on auth.users(lower(email));create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const file of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('../../supabase/migrations/' + file, 'utf8'));
  const query = (text: string, values?: unknown[]) =>
    text.startsWith('select pg_advisory_')
      ? Promise.resolve({ rows: [] })
      : db.query(text, values);
  database = {
    pool: { query, connect: async () => ({ query, release: () => {} }) },
    db: drizzle(db, { schema }),
  } as unknown as Database;
}, 30000);
beforeEach(async () => {
  await db.exec('truncate businesses,user_profiles,auth.users cascade');
  const userId = rid(),
    membershipId = rid();
  owner = rid();
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
    userId,
    'op@example.test',
    owner,
    'owner@example.test',
  ]);
  await db.query(
    "insert into user_profiles(user_id,display_name) values($1,'Operator'),($2,'Existing Owner')",
    [userId, owner],
  );
  await db.query('insert into platform_memberships(id,user_id)values($1,$2)', [
    membershipId,
    userId,
  ]);
  operator = {
    userId,
    membershipId,
    displayName: 'Operator',
    role: 'PLATFORM_OPERATOR',
  };
  created = vi.fn(async (email: string) => {
    const id = rid();
    await db.query('insert into auth.users(id,email)values($1,$2)', [
      id,
      email,
    ]);
    return { id };
  });
  issued = vi.fn(async () => ({ hashedToken: hash }));
  deleted = vi.fn(async (id: string) => {
    await db.query('delete from auth.users where id=$1', [id]);
  });
  const auth = {
    createConfirmedUser: created,
    issueRecoveryToken: issued,
    deleteUser: deleted,
    accessUrl: (token: string, business: string) =>
      `http://localhost:4000/auth/confirm?token_hash=${token}&type=recovery&business=${business}`,
  } as unknown as AuthAdminService;
  service = new PlatformService(database, auth);
});
afterAll(async () => db?.close());
it('creates a default branch and Owner with one redacted platform audit, then reuses existing case-insensitive email without overwriting profile', async () => {
  const body = input();
  body.ownerEmail = ' NEW@EXAMPLE.TEST ';
  const result = await service.createBusiness(operator, body, rid());
  expect(result.owner.created).toBe(true);
  expect(result.branch.name).toBe('Trụ sở chính');
  expect(result.accessUrl).toContain('type=recovery');
  const members = await db.query<{ role_key: string; status: string }>(
    'select role_key,status from business_memberships where business_id=$1',
    [result.business.id],
  );
  expect(members.rows).toEqual([{ role_key: 'OWNER', status: 'ACTIVE' }]);
  const second = await service.createBusiness(
    operator,
    {
      ...input(),
      ownerEmail: 'NEW@example.test',
      ownerDisplayName: 'Must not overwrite',
    },
    rid(),
  );
  expect(second.owner).toEqual({ userId: result.owner.userId, created: false });
  expect(created).toHaveBeenCalledTimes(1);
  expect(
    (
      await db.query<{ display_name: string }>(
        'select display_name from user_profiles where user_id=$1',
        [result.owner.userId],
      )
    ).rows[0].display_name,
  ).toBe('New Owner');
  const audits = await db.query<{ metadata: object }>(
    'select metadata from platform_audit_logs',
  );
  expect(audits.rows).toHaveLength(2);
  const metadata = JSON.stringify(audits.rows);
  for (const secret of ['@', 'token_hash', hash, 'accessUrl'])
    expect(metadata).not.toContain(secret);
  expect((await db.query('select id from audit_logs')).rows).toHaveLength(0);
});
it('rolls back business/profile/member/audit together and compensates only the identity created by that request', async () => {
  await db.exec(
    "alter table platform_audit_logs add constraint fail_provision check(action<>'platform.business.create') not valid",
  );
  try {
    await expect(
      service.createBusiness(operator, input(), rid()),
    ).rejects.toBeDefined();
  } finally {
    await db.exec(
      'alter table platform_audit_logs drop constraint fail_provision',
    );
  }
  expect(deleted).toHaveBeenCalledTimes(1);
  expect((await db.query('select id from businesses')).rows).toHaveLength(0);
  expect(
    (await db.query("select id from auth.users where email='new@example.test'"))
      .rows,
  ).toHaveLength(0);
  expect(
    (await service.createBusiness(operator, input(), rid())).owner.created,
  ).toBe(true);
});
it('does not issue credentials for disabled profiles or unauthorised/revoked platform identities', async () => {
  const forged = { ...operator, userId: owner };
  for (const action of [
    () => service.createBusiness(forged, input(), rid()),
    () => service.ownerLink(forged, rid(), { membershipId: rid() }, rid()),
    () => service.businessStatus(forged, rid(), { status: 'DISABLED' }, rid()),
  ])
    await expect(action()).rejects.toMatchObject({
      response: { code: 'PLATFORM_ACCESS_DENIED' },
    });
  expect(created).not.toHaveBeenCalled();
  expect(issued).not.toHaveBeenCalled();
  await db.query(
    "update platform_memberships set status='DISABLED' where user_id=$1",
    [operator.userId],
  );
  await expect(
    service.createBusiness(operator, input(), rid()),
  ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
  await db.query(
    "update platform_memberships set status='ACTIVE' where user_id=$1",
    [operator.userId],
  );
  await db.query(
    "update user_profiles set status='DISABLED' where user_id=$1",
    [owner],
  );
  await expect(
    service.createBusiness(
      operator,
      { ...input(), ownerEmail: 'owner@example.test' },
      rid(),
    ),
  ).rejects.toMatchObject({ response: { code: 'PLATFORM_OWNER_DISABLED' } });
  expect(issued).not.toHaveBeenCalled();
});
it('issues Owner links only for current active memberships in the selected active business and records no capability', async () => {
  const result = await service.createBusiness(operator, input(), rid());
  const member = (
    await db.query<{ id: string }>(
      'select id from business_memberships where business_id=$1',
      [result.business.id],
    )
  ).rows[0];
  const link = await service.ownerLink(
    operator,
    result.business.id,
    { membershipId: member.id },
    rid(),
  );
  expect(link.accessUrl).toContain('business=' + result.business.id);
  await expect(
    service.ownerLink(
      operator,
      result.business.id,
      { membershipId: rid() },
      rid(),
    ),
  ).rejects.toMatchObject({
    response: { code: 'PLATFORM_OWNER_NOT_AVAILABLE' },
  });
  await db.query(
    "update business_memberships set status='DISABLED' where id=$1",
    [member.id],
  );
  await expect(
    service.ownerLink(
      operator,
      result.business.id,
      { membershipId: member.id },
      rid(),
    ),
  ).rejects.toMatchObject({
    response: { code: 'PLATFORM_OWNER_NOT_AVAILABLE' },
  });
  await db.query(
    "update business_memberships set status='ACTIVE' where id=$1",
    [member.id],
  );
  await db.query(
    "update user_profiles set status='DISABLED' where user_id=$1",
    [result.owner.userId],
  );
  await expect(
    service.ownerLink(
      operator,
      result.business.id,
      { membershipId: member.id },
      rid(),
    ),
  ).rejects.toMatchObject({
    response: { code: 'PLATFORM_OWNER_NOT_AVAILABLE' },
  });
  expect(
    JSON.stringify(
      (await db.query('select metadata from platform_audit_logs')).rows,
    ),
  ).not.toContain(hash);
});
it('suspends and reactivates tenant reads and writes under the tenant business lock without tenant audit', async () => {
  const result = await service.createBusiness(operator, input(), rid());
  const member = (
    await db.query<{ id: string }>(
      'select id from business_memberships where business_id=$1',
      [result.business.id],
    )
  ).rows[0];
  const request = {
    identity: { id: result.owner.userId },
    headers: { 'x-business-id': result.business.id },
  };
  const guard = new TenantGuard(database);
  await expect(guard.canActivate(context(request))).resolves.toBe(true);
  const tenant = {
    userId: result.owner.userId,
    email: 'new@example.test',
    businessId: result.business.id,
    businessName: 'New business',
    membershipId: member.id,
    role: 'OWNER',
  };
  await service.businessStatus(
    operator,
    result.business.id,
    { status: 'DISABLED' },
    rid(),
  );
  await expect(guard.canActivate(context(request))).rejects.toMatchObject({
    response: { code: 'TENANT_ACCESS_DENIED' },
  });
  await expect(
    new CoreService(database).updateBusiness(
      tenant,
      { name: 'Blocked' },
      rid(),
    ),
  ).rejects.toMatchObject({ response: { code: 'TENANT_ACCESS_DENIED' } });
  await expect(
    service.ownerLink(
      operator,
      result.business.id,
      { membershipId: member.id },
      rid(),
    ),
  ).rejects.toMatchObject({ response: { code: 'PLATFORM_BUSINESS_DISABLED' } });
  await service.businessStatus(
    operator,
    result.business.id,
    { status: 'ACTIVE' },
    rid(),
  );
  await expect(guard.canActivate(context(request))).resolves.toBe(true);
  expect((await db.query('select id from audit_logs')).rows).toHaveLength(0);
});
it('validates strict bounded provisioning inputs and declares independent guards/no-store response headers', async () => {
  expect(await validate(input())).toHaveLength(0);
  for (const extra of [
    { name: ' ' },
    { ownerEmail: 'broken' },
    { timezone: 'Mars/Nowhere' },
    { currency: 'vnd' },
    { ownerDisplayName: '' },
    { firstBranchName: ' ' },
  ])
    expect(
      (
        await validate(
          plainToInstance(PlatformBusinessCreate, { ...input(), ...extra }),
        )
      ).length,
    ).toBeGreaterThan(0);
  const guard = new PlatformGuard(database, new Reflector());
  await expect(
    guard.canActivate(context({ identity: { id: owner }, headers: {} })),
  ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
  for (const [method, permission] of [
    ['createBusiness', 'platform.business.create'],
    ['ownerLink', 'platform.owner.access'],
    ['businessStatus', 'platform.business.manage'],
  ]) {
    const handler = Object.getOwnPropertyDescriptor(
      PlatformController.prototype,
      method,
    )!.value;
    expect(Reflect.getMetadata('platformPermission', handler)).toBe(permission);
    expect(Reflect.getMetadata('__headers__', handler)).toContainEqual({
      name: 'Cache-Control',
      value: 'no-store',
    });
  }
});

it('cleans an Auth failure before any business is created, but never deletes a reused identity after DB rollback', async () => {
  issued.mockRejectedValueOnce(new Error('provider-token-secret'));
  await expect(
    service.createBusiness(operator, input(), rid()),
  ).rejects.toBeDefined();
  expect(deleted).toHaveBeenCalledTimes(1);
  expect((await db.query('select id from businesses')).rows).toHaveLength(0);
  deleted.mockClear();
  await db.exec(
    "alter table platform_audit_logs add constraint fail_existing_provision check(action<>'platform.business.create') not valid",
  );
  try {
    await expect(
      service.createBusiness(
        operator,
        { ...input(), ownerEmail: 'owner@example.test' },
        rid(),
      ),
    ).rejects.toBeDefined();
  } finally {
    await db.exec(
      'alter table platform_audit_logs drop constraint fail_existing_provision',
    );
  }
  expect(deleted).not.toHaveBeenCalled();
  expect(
    (await db.query('select id from auth.users where id=$1', [owner])).rows,
  ).toHaveLength(1);
});
it('never accepts a membership belonging to a different business', async () => {
  const first = await service.createBusiness(operator, input(), rid());
  const second = await service.createBusiness(
    operator,
    { ...input(), ownerEmail: 'other@example.test' },
    rid(),
  );
  const member = (
    await db.query<{ id: string }>(
      'select id from business_memberships where business_id=$1',
      [second.business.id],
    )
  ).rows[0];
  const calls = issued.mock.calls.length;
  await expect(
    service.ownerLink(
      operator,
      first.business.id,
      { membershipId: member.id },
      rid(),
    ),
  ).rejects.toMatchObject({
    response: { code: 'PLATFORM_OWNER_NOT_AVAILABLE' },
  });
  expect(issued.mock.calls).toHaveLength(calls);
});
