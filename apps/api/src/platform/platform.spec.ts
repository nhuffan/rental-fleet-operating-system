import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { drizzle } from 'drizzle-orm/pglite';
import type { Database } from '../database/database.js';
import { TenantGuard } from '../auth/guards.js';
import * as schema from '../database/schema.js';
import { PlatformGuard, type PlatformContext } from './guards.js';
import { PlatformBusinessQuery } from './dto.js';
import { PlatformService } from './platform.service.js';
import { platformPermissionsFor } from './permissions.js';
let db: PGlite,
  database: Database,
  service: PlatformService,
  guard: PlatformGuard,
  tenantGuard: TenantGuard;
let operator: PlatformContext,
  owner: string,
  businessA: string,
  businessB: string;
const exec = (body: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => body }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  }) as unknown as ExecutionContext;
const rid = () => randomUUID();
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const file of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('../../supabase/migrations/' + file, 'utf8'));
  const pool = {
    query: (text: string, values?: unknown[]) => db.query(text, values),
    connect: async () => ({
      query: (text: string, values?: unknown[]) => db.query(text, values),
      release: () => undefined,
    }),
  };
  database = { pool, db: drizzle(db, { schema }) } as unknown as Database;
  service = new PlatformService(database);
  guard = new PlatformGuard(database, new Reflector());
  tenantGuard = new TenantGuard(database);
}, 30000);
beforeEach(async () => {
  const opId = rid();
  owner = rid();
  businessA = rid();
  businessB = rid();
  const membership = rid();
  await db.query('insert into auth.users values($1),($2)', [opId, owner]);
  await db.query(
    "insert into user_profiles(user_id,display_name) values($1,'Operator'),($2,'Private Owner')",
    [opId, owner],
  );
  await db.query(
    "insert into platform_memberships(id,user_id,role_key) values($1,$2,'PLATFORM_OPERATOR')",
    [membership, opId],
  );
  operator = {
    userId: opId,
    membershipId: membership,
    displayName: 'Operator',
    role: 'PLATFORM_OPERATOR',
  };
  await db.query(
    "insert into businesses(id,name,status) values($1,'A_100','ACTIVE'),($2,'AB100','DISABLED')",
    [businessA, businessB],
  );
  await db.query(
    "insert into business_memberships(business_id,user_id,role_key) values($1,$2,'OWNER'),($3,$2,'OWNER')",
    [businessA, owner, businessB],
  );
  await db.query(
    "insert into branches(business_id,name,address) values($1,'Branch','Private address')",
    [businessA],
  );
  const vehicle = rid(),
    device = rid(),
    assignment = rid();
  await db.query(
    "insert into vehicles(id,business_id,license_plate,make,model)values($1,$2,$3,'Test','Private model')",
    [
      vehicle,
      businessA,
      'P' + rid().replaceAll('-', '').slice(0, 12).toUpperCase(),
    ],
  );
  await db.query(
    "insert into gps_devices(id,business_id,provider,device_uid)values($1,$2,'traccar',$3)",
    [device, businessA, 'PRIVATE-UID-' + rid()],
  );
  await db.query(
    "insert into device_assignments(id,business_id,vehicle_id,device_id,assigned_at)values($1,$2,$3,$4,clock_timestamp()-interval '1 hour')",
    [assignment, businessA, vehicle, device],
  );
  await db.query(
    "insert into gps_positions(business_id,assignment_id,device_id,vehicle_id,provider,device_uid,event_key,recorded_at,latitude,longitude,speed_kph,heading)values($1,$2,$3,$4,'traccar','PRIVATE-UID',repeat('a',64),clock_timestamp(),10.77,106.7,20,90)",
    [businessA, assignment, device, vehicle],
  );
});
afterAll(async () => {
  await db?.close();
});
it('denies tenant OWNER and forged metadata regardless of selected business; never grants tenant access to platform-only operators', async () => {
  for (const headers of [
    {},
    { 'x-business-id': businessA },
    { 'x-business-id': businessB },
    { 'x-business-id': 'not-a-uuid' },
  ])
    await expect(
      guard.canActivate(
        exec({
          identity: { id: owner, user_metadata: { role: 'PLATFORM_OPERATOR' } },
          headers,
          tenant: { role: 'OWNER' },
        }),
      ),
    ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
  for (const headers of [
    {},
    { 'x-business-id': businessA },
    { 'x-business-id': 'not-a-uuid' },
  ]) {
    const request: {
      identity: { id: string };
      headers: Record<string, string | undefined>;
      platform?: PlatformContext;
    } = { identity: { id: operator.userId }, headers };
    expect(await guard.canActivate(exec(request))).toBe(true);
    expect(request.platform?.membershipId).toBe(operator.membershipId);
  }
  await expect(
    tenantGuard.canActivate(
      exec({
        identity: { id: operator.userId },
        headers: { 'x-business-id': businessA },
      }),
    ),
  ).rejects.toMatchObject({ response: { code: 'TENANT_ACCESS_DENIED' } });
  expect(platformPermissionsFor('OWNER')).toEqual([]);
  expect(platformPermissionsFor('PLATFORM_OPERATOR')).toEqual([
    'platform.overview.read',
    'platform.business.read',
  ]);
});
it.each(['membership', 'profile', 'role'])(
  'rejects disabled/unsupported %s at guard and rechecks a formerly authorized context under transaction locks',
  async (kind) => {
    if (kind === 'membership')
      await db.query(
        "update platform_memberships set status='DISABLED' where id=$1",
        [operator.membershipId],
      );
    if (kind === 'profile')
      await db.query(
        "update user_profiles set status='DISABLED' where user_id=$1",
        [operator.userId],
      );
    if (kind === 'role') {
      await db.exec(
        'alter table platform_memberships drop constraint platform_memberships_role_check',
      );
      await db.query(
        "update platform_memberships set role_key='OWNER' where id=$1",
        [operator.membershipId],
      );
    }
    try {
      await expect(
        guard.canActivate(
          exec({ identity: { id: operator.userId }, headers: {} }),
        ),
      ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
      await expect(service.overview(operator, rid())).rejects.toMatchObject({
        response: { code: 'PLATFORM_ACCESS_DENIED' },
      });
    } finally {
      if (kind === 'role') {
        await db.query(
          "update platform_memberships set role_key='PLATFORM_OPERATOR' where id=$1",
          [operator.membershipId],
        );
        await db.exec(
          "alter table platform_memberships add constraint platform_memberships_role_check check(role_key='PLATFORM_OPERATOR')",
        );
      }
    }
    const audit = await db.query<{ n: number }>(
      'select count(*)::int n from platform_audit_logs where actor_user_id=$1',
      [operator.userId],
    );
    expect(audit.rows[0].n).toBe(0);
  },
);
it('returns only approved metadata, truthful counts and separate atomic read audits', async () => {
  const me = await service.me(operator, rid());
  expect(me).toMatchObject({
    principal: {
      id: operator.membershipId,
      userId: operator.userId,
      displayName: 'Operator',
      role: 'PLATFORM_OPERATOR',
    },
    readOnly: true,
  });
  const row = await service.business(operator, businessA, rid());
  expect(row).toMatchObject({
    id: businessA,
    status: 'ACTIVE',
    counts: {
      branches: 1,
      activeBranches: 1,
      memberships: 1,
      activeMemberships: 1,
      vehicles: 1,
      activeVehicles: 1,
      rentals: 0,
    },
    gps: {
      sourceMode: 'TEST',
      FRESH: 1,
      STALE: 0,
      OFFLINE: 0,
      NO_DATA: 0,
      UNASSIGNED: 0,
    },
  });
  expect(Object.keys(row).sort()).toEqual([
    'counts',
    'createdAt',
    'currency',
    'gps',
    'id',
    'name',
    'status',
    'timezone',
    'updatedAt',
  ]);
  for (const privateText of [
    'Private Owner',
    'Private address',
    'Private model',
    'PRIVATE-UID',
    'latitude',
    'longitude',
    'email',
    'eventKey',
    'deviceId',
    'userId',
  ])
    expect(JSON.stringify(row)).not.toContain(privateText);
  const overview = await service.overview(operator, rid());
  expect(overview.businesses.total).toBeGreaterThanOrEqual(2);
  expect(overview.businesses.DISABLED).toBeGreaterThanOrEqual(1);
  expect(overview.gps.sourceMode).toBe('TEST');
  const audit = await db.query<{
    action: string;
    metadata: Record<string, unknown>;
  }>(
    'select action,metadata from platform_audit_logs where actor_user_id=$1 order by created_at',
    [operator.userId],
  );
  expect(audit.rows.map((r) => r.action)).toEqual([
    'platform.me.read',
    'platform.business.read',
    'platform.overview.read',
  ]);
  expect(
    audit.rows.every((r) => Object.keys(r.metadata).join() === 'requestId'),
  ).toBe(true);
  expect(
    (
      await db.query<{ n: number }>(
        'select count(*)::int n from audit_logs where actor_user_id=$1',
        [operator.userId],
      )
    ).rows[0].n,
  ).toBe(0);
});
it('paginates with stable ties, literal search and explicit filters without per-business data calls', async () => {
  const literal = await service.businesses(
    operator,
    Object.assign(new PlatformBusinessQuery(), {
      search: 'A_100',
      limit: 1,
      sort: 'name',
      order: 'asc',
    }),
    rid(),
  );
  expect(literal.data.every((b) => b.name === 'A_100')).toBe(true);
  expect(literal.total).toBeGreaterThan(0);
  const q = Object.assign(new PlatformBusinessQuery(), {
    limit: 1,
    sort: 'name',
    order: 'asc',
    status: 'DISABLED',
  });
  const first = await service.businesses(operator, q, rid()),
    second = await service.businesses(
      operator,
      Object.assign(new PlatformBusinessQuery(), q, { page: 2 }),
      rid(),
    );
  expect(first.data[0].status).toBe('DISABLED');
  if (second.data.length) expect(first.data[0].id).not.toBe(second.data[0].id);
  await expect(service.business(operator, rid(), rid())).rejects.toMatchObject({
    response: { code: 'PLATFORM_BUSINESS_NOT_FOUND' },
  });
});
it('fails closed if platform audit insert fails and never releases an unaudited read', async () => {
  await db.exec(
    "alter table platform_audit_logs add constraint platform_test_audit_failure check(action<>'platform.business.read') not valid",
  );
  try {
    await expect(
      service.business(operator, businessA, rid()),
    ).rejects.toBeDefined();
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from platform_audit_logs where actor_user_id=$1',
          [operator.userId],
        )
      ).rows[0].n,
    ).toBe(0);
  } finally {
    await db.exec(
      'alter table platform_audit_logs drop constraint platform_test_audit_failure',
    );
  }
});
it('validates business list bounds and does not accept arbitrary sort fragments', async () => {
  expect(
    await validate(
      plainToInstance(PlatformBusinessQuery, {
        limit: '100',
        status: 'ACTIVE',
        search: ' A ',
        sort: 'name',
        order: 'asc',
      }),
    ),
  ).toHaveLength(0);
  for (const value of [
    { limit: '101' },
    { page: '0' },
    { status: 'SUSPENDED' },
    { sort: 'name;drop table businesses' },
    { order: 'random' },
    { search: 'x'.repeat(121) },
  ])
    expect(
      (await validate(plainToInstance(PlatformBusinessQuery, value))).length,
    ).toBeGreaterThan(0);
});
