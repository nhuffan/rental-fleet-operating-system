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
import { PlatformController } from './platform.controller.js';
import { PageQuery } from '../core/dto.js';
import {
  PlatformAuditQuery,
  PlatformUserQuery,
  PlatformBusinessQuery,
} from './dto.js';
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
    'platform.audit.read',
    'platform.user.read',
    'platform.business.create',
    'platform.business.manage',
    'platform.owner.access',
    'platform.system.read',
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
      await expect(
        service.users(operator, new PlatformUserQuery(), rid()),
      ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
      await expect(
        service.user(operator, owner, new PageQuery(), rid()),
      ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
      await expect(
        service.audit(operator, new PlatformAuditQuery(), rid()),
      ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
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
    readOnly: false,
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
    'owners',
    'status',
    'timezone',
    'updatedAt',
  ]);
  expect(row.owners.data[0]).toMatchObject({
    userId: owner,
    displayName: 'Private Owner',
    status: 'ACTIVE',
    profileStatus: 'ACTIVE',
  });
  for (const privateText of [
    'Private address',
    'Private model',
    'PRIVATE-UID',
    'latitude',
    'longitude',
    'email',
    'eventKey',
    'deviceId',
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

it('uses explicit independent permissions for every new support route and denies an ungranted stale context', async () => {
  expect(
    Reflect.getMetadata(
      'platformPermission',
      Object.getOwnPropertyDescriptor(PlatformController.prototype, 'audit')!
        .value,
    ),
  ).toBe('platform.audit.read');
  expect(
    Reflect.getMetadata(
      'platformPermission',
      Object.getOwnPropertyDescriptor(PlatformController.prototype, 'users')!
        .value,
    ),
  ).toBe('platform.user.read');
  expect(
    Reflect.getMetadata(
      'platformPermission',
      Object.getOwnPropertyDescriptor(PlatformController.prototype, 'user')!
        .value,
    ),
  ).toBe('platform.user.read');
  const forged = { ...operator, userId: owner };
  await expect(
    service.users(forged, new PlatformUserQuery(), rid()),
  ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
  await expect(
    service.audit(forged, new PlatformAuditQuery(), rid()),
  ).rejects.toMatchObject({ response: { code: 'PLATFORM_ACCESS_DENIED' } });
});
it('counts unique profiles and returns bounded safe membership summaries including disabled states', async () => {
  const q = Object.assign(new PlatformUserQuery(), {
    businessId: businessA,
    limit: 1,
  });
  const list = await service.users(operator, q, rid());
  expect(list.total).toBe(1);
  expect(list.data).toHaveLength(1);
  expect(list.data[0]).toMatchObject({
    id: owner,
    displayName: 'Private Owner',
    membershipCount: 2,
    activeMembershipCount: 1,
    platformStatus: 'NONE',
    roles: ['OWNER'],
  });
  const detail = await service.user(
    operator,
    owner,
    Object.assign(new PageQuery(), { limit: 1 }),
    rid(),
  );
  const next = await service.user(
    operator,
    owner,
    Object.assign(new PageQuery(), { limit: 1, page: 2 }),
    rid(),
  );
  expect(detail.memberships.total).toBe(2);
  expect(detail.memberships.data).toHaveLength(1);
  expect(next.memberships.data).toHaveLength(1);
  expect(detail.memberships.data[0].id).not.toBe(next.memberships.data[0].id);
  expect(
    [
      detail.memberships.data[0].businessStatus,
      next.memberships.data[0].businessStatus,
    ].sort(),
  ).toEqual(['ACTIVE', 'DISABLED']);
  for (const key of [
    'email',
    'phone',
    'password',
    'metadata',
    'deviceUid',
    'latitude',
    'longitude',
    'address',
  ])
    expect(JSON.stringify(detail)).not.toContain(key);
  await db.query(
    "update business_memberships set status='DISABLED' where user_id=$1 and business_id=$2",
    [owner, businessA],
  );
  const disabled = await service.users(
    operator,
    Object.assign(new PlatformUserQuery(), {
      businessId: businessA,
      membershipStatus: 'DISABLED',
    }),
    rid(),
  );
  expect(disabled.total).toBe(1);
  expect(disabled.data[0].activeMembershipCount).toBe(0);
  await db.query(
    "update user_profiles set display_name='Literal_%User' where user_id=$1",
    [owner],
  );
  expect(
    (
      await service.users(
        operator,
        Object.assign(new PlatformUserQuery(), {
          search: 'Literal_%User',
          businessId: businessA,
        }),
        rid(),
      )
    ).total,
  ).toBe(1);
  expect(
    (
      await service.users(
        operator,
        Object.assign(new PlatformUserQuery(), {
          businessId: businessA,
          membershipStatus: 'ACTIVE',
        }),
        rid(),
      )
    ).total,
  ).toBe(0);
  await expect(
    service.user(operator, rid(), new PageQuery(), rid()),
  ).rejects.toMatchObject({ response: { code: 'PLATFORM_USER_NOT_FOUND' } });
  const audits = await db.query<{ entity_type: string; entity_id: string }>(
    "select entity_type,entity_id from platform_audit_logs where actor_user_id=$1 and action='platform.user.read'",
    [operator.userId],
  );
  expect(
    audits.rows.every((a) => a.entity_type === 'user' && a.entity_id === owner),
  ).toBe(true);
});
it('projects reviewed audit fields only, filters target/date/action, and never reads tenant audit', async () => {
  const goodId = rid(),
    requestId = rid();
  await db.query(
    "insert into platform_audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata,created_at) values($1,$2,'platform.business.read','business',$3,$4,'2020-01-02T00:00:00Z')",
    [
      goodId,
      operator.userId,
      businessA,
      JSON.stringify({
        requestId,
        email: 'private@example.test',
        token: 'SECRET',
        latitude: 10,
        deviceUid: 'PRIVATE-TRACKER',
        body: { password: 'SECRET' },
      }),
    ],
  );
  await db.query(
    "insert into platform_audit_logs(actor_user_id,action,entity_type,entity_id,metadata,created_at) values($1,'unreviewed-private@example.test','PRIVATE-TRACKER',$2,$3,'2020-01-03T00:00:00Z')",
    [
      operator.userId,
      businessA,
      JSON.stringify({ requestId: 'private@example.test' }),
    ],
  );
  await db.query(
    "insert into audit_logs(business_id,actor_user_id,action,entity_type,entity_id)values($1,$2,'TENANT-ONLY','business',$1)",
    [businessA, operator.userId],
  );
  const q = Object.assign(new PlatformAuditQuery(), {
    from: '2020-01-01T00:00:00Z',
    until: '2020-02-01T00:00:00Z',
    businessId: businessA,
    limit: 1,
  });
  const audit = await service.audit(operator, q, rid());
  expect(audit.total).toBe(1);
  expect(audit.data[0]).toEqual({
    id: goodId,
    actorId: operator.userId,
    action: 'platform.business.read',
    entityType: 'business',
    entityId: businessA,
    requestId,
    createdAt: expect.any(String),
  });
  const second = await service.audit(
    operator,
    Object.assign(new PlatformAuditQuery(), {
      from: q.from,
      until: q.until,
      action: 'other',
      limit: 1,
    }),
    rid(),
  );
  expect(
    second.data.some(
      (a) =>
        a.entityId === null && a.entityType === 'other' && a.requestId === null,
    ),
  ).toBe(true);
  expect(JSON.stringify(audit)).not.toMatch(
    /SECRET|email|latitude|deviceUid|metadata|TENANT-ONLY/,
  );
  expect(
    (
      await service.audit(
        operator,
        Object.assign(new PlatformAuditQuery(), q, {
          action: 'platform.user.read',
        }),
        rid(),
      )
    ).total,
  ).toBe(0);
  expect(
    (
      await service.audit(
        operator,
        Object.assign(new PlatformAuditQuery(), q, { page: 2 }),
        rid(),
      )
    ).data,
  ).toHaveLength(0);
});
it('rejects invalid support query bounds, arbitrary sorts, UUIDs and audit date ranges', async () => {
  for (const [klass, values] of [
    [
      PlatformUserQuery,
      [
        { limit: 101 },
        { businessId: 'x' },
        { roleKey: 'PLATFORM_OPERATOR' },
        { membershipStatus: 'ANY' },
        { sort: 'display_name desc;select 1' },
        { search: 'x'.repeat(121) },
      ],
    ],
    [
      PlatformAuditQuery,
      [
        { limit: 101 },
        { action: 'customer.read' },
        { businessId: 'x' },
        { from: '2020-01-01' },
        { from: 'not-dateZ' },
        { sort: 'metadata' },
        { order: 'random' },
      ],
    ],
  ] as const)
    for (const value of values)
      expect(
        (
          await validate(plainToInstance<object, unknown>(klass, value), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      ).toBeGreaterThan(0);
  for (const q of [
    { from: '2020-01-02T00:00:00Z', until: '2020-01-01T00:00:00Z' },
    { from: '2020-01-01T00:00:00Z', until: '2022-01-01T00:00:00Z' },
  ])
    await expect(
      service.audit(
        operator,
        Object.assign(new PlatformAuditQuery(), q),
        rid(),
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_AUDIT_RANGE' } });
});
it.each(['platform.audit.read', 'platform.users.read', 'platform.user.read'])(
  'fails closed when audit persistence fails for %s',
  async (action) => {
    await db.exec(
      `alter table platform_audit_logs add constraint platform_support_test_failure check(action<>'${action}') not valid`,
    );
    try {
      const read =
        action === 'platform.audit.read'
          ? service.audit(operator, new PlatformAuditQuery(), rid())
          : action === 'platform.users.read'
            ? service.users(operator, new PlatformUserQuery(), rid())
            : service.user(operator, owner, new PageQuery(), rid());
      await expect(read).rejects.toBeDefined();
    } finally {
      await db.exec(
        'alter table platform_audit_logs drop constraint platform_support_test_failure',
      );
    }
  },
);

it('returns read-only system status with platform audit and no secret values', async () => {
  process.env.SUPABASE_SECRET_KEY = 'SECRET-KEY-VALUE-999';
  try {
    const status = await service.system(operator, rid());
    expect(status).toMatchObject({
      database: { reachable: true },
      limits: { gpsRequestsPerMinute: 600 },
    });
    expect(status.features.length).toBeGreaterThan(5);
    expect(JSON.stringify(status)).not.toContain('SECRET-KEY-VALUE-999');
    const audit = await db.query(
      "select metadata from platform_audit_logs where action='platform.system.read' and actor_user_id=$1",
      [operator.userId],
    );
    expect(audit.rows).toHaveLength(1);
  } finally {
    delete process.env.SUPABASE_SECRET_KEY;
  }
});
