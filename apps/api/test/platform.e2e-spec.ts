import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/http.js';
import { Database } from '../dist/database/database.js';
import { loadConfig } from '../dist/config.js';
type Demo = {
  projectRef: string;
  businessA: string;
  businessB: string;
  accounts: Record<string, { id: string; email: string; password: string }>;
};
const demo = JSON.parse(readFileSync('../../.env.demo.json', 'utf8')) as Demo;
const tokens: Record<string, string> = {};
let app: INestApplication | undefined, database: Database | undefined;
let opMembershipId: string;
let tenantAuditBefore = 0;
function api(actor = 'platformOperator', business?: string) {
  if (!app) throw new Error('Platform app not ready');
  const req = request(app.getHttpServer());
  return {
    get: (path: string) =>
      req
        .get('/api/v1' + path)
        .set('Authorization', 'Bearer ' + tokens[actor])
        .set(business ? { 'X-Business-Id': business } : {}),
  };
}
beforeAll(async () => {
  process.env.LOG_REQUESTS = 'false';
  const c = loadConfig(),
    expected = 'eeryymswcufnebibigqf';
  if (
    c.environment !== 'development' ||
    new URL(c.supabaseUrl).hostname !== expected + '.supabase.co' ||
    demo.projectRef !== expected
  )
    throw new Error(
      'Platform E2E is restricted to the seeded development project',
    );
  if (!demo.accounts.platformOperator)
    throw new Error(
      'Run the dedicated development platform bootstrap before Platform E2E',
    );
  for (const actor of ['platformOperator', 'ownerA', 'adminA', 'operationsA']) {
    const client = createClient(c.supabaseUrl, c.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: demo.accounts[actor].email,
      password: demo.accounts[actor].password,
    });
    if (error || !data.session)
      throw new Error('Platform development fixture login failed: ' + actor);
    tokens[actor] = data.session.access_token;
  }
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  database = app.get(Database);
  const membership = await database!.pool.query<{ id: string }>(
    "select id from public.platform_memberships where user_id=$1 and role_key='PLATFORM_OPERATOR' and status='ACTIVE'",
    [demo.accounts.platformOperator.id],
  );
  if (!membership.rows[0])
    throw new Error('Development platform fixture is not active');
  opMembershipId = membership.rows[0].id;
  const existing = await database!.pool.query<{ n: number }>(
    'select count(*)::int n from public.audit_logs where actor_user_id=$1',
    [demo.accounts.platformOperator.id],
  );
  tenantAuditBefore = existing.rows[0].n;
}, 60000);
afterAll(async () => {
  await app?.close();
});
it('requires real Supabase identity plus dedicated platform grant, independent of tenant headers', async () => {
  await request(app!.getHttpServer())
    .get('/api/v1/platform/overview')
    .expect(401);
  for (const actor of ['ownerA', 'adminA', 'operationsA'])
    for (const business of [
      undefined,
      demo.businessA,
      demo.businessB,
      'not-a-uuid',
    ]) {
      const denied = await api(actor, business)
        .get('/platform/overview')
        .expect(403);
      expect(denied.body.code).toBe('PLATFORM_ACCESS_DENIED');
    }
  const own = await api('platformOperator', 'not-a-uuid')
    .get('/platform/me')
    .expect(200);
  expect(own.body).toMatchObject({
    principal: {
      userId: demo.accounts.platformOperator.id,
      role: 'PLATFORM_OPERATOR',
    },
    permissions: [
      'platform.overview.read',
      'platform.business.read',
      'platform.audit.read',
      'platform.user.read',
    ],
    readOnly: true,
  });
  expect(own.body).not.toHaveProperty('business');
  expect(own.body.principal).not.toHaveProperty('email');
  // A global read grant never creates a tenant operational membership.
  await api('platformOperator', demo.businessA).get('/vehicles').expect(403);
  await api('platformOperator').get('/me').expect(403);
}, 60000);
it('returns real bounded platform metadata and aggregates while preserving Business Admin tenant isolation', async () => {
  const overview = await api().get('/platform/overview').expect(200);
  expect(overview.body.businesses.total).toBeGreaterThanOrEqual(2);
  expect(overview.body.gps.sourceMode).toBe('TEST');
  const list = await api()
    .get('/platform/businesses?limit=1&sort=name&order=asc')
    .expect(200);
  expect(list.body).toMatchObject({ page: 1, limit: 1 });
  expect(list.body.data).toHaveLength(1);
  const next = await api()
    .get('/platform/businesses?limit=1&page=2&sort=name&order=asc')
    .expect(200);
  expect(list.body.data[0].id).not.toBe(next.body.data[0].id);
  for (const businessId of [demo.businessA, demo.businessB]) {
    const detail = await api('platformOperator', demo.businessA)
      .get('/platform/businesses/' + businessId)
      .expect(200);
    expect(detail.body.id).toBe(businessId);
    expect(detail.body).toHaveProperty('counts.activeMemberships');
    expect(detail.body.gps.sourceMode).toBe('TEST');
    for (const privateKey of [
      'email',
      'deviceUid',
      'latitude',
      'longitude',
      'eventKey',
      'notes',
      'databaseUrl',
      'password',
      'service_role',
    ])
      expect(JSON.stringify(detail.body)).not.toContain(privateKey);
  }
  const tenant = await api('ownerA', demo.businessA).get('/me').expect(200);
  expect(tenant.body.business.id).toBe(demo.businessA);
  await api('ownerA', demo.businessB).get('/vehicles').expect(403);
  await api().get('/platform/businesses?limit=101').expect(400);
  await api().get('/platform/businesses?sort=random').expect(400);
  await api().get('/platform/businesses?status=SUSPENDED').expect(400);
  await api()
    .get('/platform/businesses/' + randomUUID())
    .expect(404);
}, 60000);
it('revokes disabled principals and profiles immediately and keeps platform reads in their own audit table', async () => {
  await database!.pool.query(
    "update public.platform_memberships set status='DISABLED' where id=$1 and user_id=$2",
    [opMembershipId, demo.accounts.platformOperator.id],
  );
  try {
    const disabled = await api().get('/platform/me').expect(403);
    expect(disabled.body.code).toBe('PLATFORM_ACCESS_DENIED');
    await api().get('/platform/audit').expect(403);
    await api().get('/platform/users').expect(403);
  } finally {
    await database!.pool.query(
      "update public.platform_memberships set status='ACTIVE' where id=$1 and user_id=$2",
      [opMembershipId, demo.accounts.platformOperator.id],
    );
  }
  await database!.pool.query(
    "update public.user_profiles set status='DISABLED' where user_id=$1",
    [demo.accounts.platformOperator.id],
  );
  try {
    await api().get('/platform/businesses').expect(403);
    await api().get('/platform/audit').expect(403);
    await api()
      .get('/platform/users/' + demo.accounts.ownerA.id)
      .expect(403);
  } finally {
    await database!.pool.query(
      "update public.user_profiles set status='ACTIVE' where user_id=$1",
      [demo.accounts.platformOperator.id],
    );
  }
  await api().get('/platform/me').expect(200);
  const audits = await database!.pool.query<{
    action: string;
    metadata: Record<string, unknown>;
  }>(
    "select action,metadata from public.platform_audit_logs where actor_user_id=$1 and action like 'platform.%read'",
    [demo.accounts.platformOperator.id],
  );
  expect(audits.rows.length).toBeGreaterThan(0);
  expect(
    audits.rows.every((a) => Object.keys(a.metadata).join() === 'requestId'),
  ).toBe(true);
  const tenantAudits = await database!.pool.query<{ n: number }>(
    'select count(*)::int n from public.audit_logs where actor_user_id=$1',
    [demo.accounts.platformOperator.id],
  );
  expect(tenantAudits.rows[0].n).toBe(tenantAuditBefore);
}, 60000);
it('denies direct platform table access to the publishable Data API even for an operator', async () => {
  const c = loadConfig();
  const client = createClient(c.supabaseUrl, c.publishableKey, {
    global: { headers: { Authorization: 'Bearer ' + tokens.platformOperator } },
    auth: { persistSession: false },
  });
  for (const table of ['platform_memberships', 'platform_audit_logs']) {
    const read = await client.from(table).select('*');
    expect(read.error).not.toBeNull();
    const write = await client.from(table).insert({ id: randomUUID() });
    expect(write.error).not.toBeNull();
  }
}, 30000);

it('serves new support reads only to the independent operator and validates real query boundaries', async () => {
  for (const actor of ['ownerA', 'adminA', 'operationsA'])
    for (const path of [
      '/platform/audit',
      '/platform/users',
      '/platform/users/' + demo.accounts.ownerA.id,
    ])
      await api(actor, demo.businessA).get(path).expect(403);
  for (const path of ['/platform/audit', '/platform/users'])
    await request(app!.getHttpServer())
      .get('/api/v1' + path)
      .expect(401);
  const users = await api()
    .get('/platform/users?limit=1&businessId=' + demo.businessA)
    .expect(200);
  expect(users.body.data).toHaveLength(1);
  const unique = await database!.pool.query<{ n: number }>(
    'select count(distinct user_id)::int n from public.business_memberships where business_id=$1',
    [demo.businessA],
  );
  expect(users.body.total).toBe(unique.rows[0].n);
  const detail = await api()
    .get('/platform/users/' + demo.accounts.ownerA.id + '?limit=1')
    .expect(200);
  expect(detail.body.profile.id).toBe(demo.accounts.ownerA.id);
  expect(detail.body.memberships.data.length).toBeLessThanOrEqual(1);
  const audit = await api()
    .get('/platform/audit?limit=1&businessId=' + demo.businessA)
    .expect(200);
  expect(audit.body.data.length).toBeLessThanOrEqual(1);
  for (const row of audit.body.data) {
    expect(Object.keys(row).sort()).toEqual([
      'action',
      'actorId',
      'createdAt',
      'entityId',
      'entityType',
      'id',
      'requestId',
    ]);
    expect(row.entityType).toBe('business');
    expect(row.entityId).toBe(demo.businessA);
  }
  for (const data of [users.body, detail.body, audit.body])
    for (const key of [
      'email',
      'phone',
      'password',
      'metadata',
      'deviceUid',
      'latitude',
      'longitude',
      'service_role',
    ])
      expect(JSON.stringify(data)).not.toContain(key);
  for (const path of [
    '/platform/users?limit=101',
    '/platform/users?businessId=x',
    '/platform/users?roleKey=PLATFORM_OPERATOR',
    '/platform/audit?limit=101',
    '/platform/audit?sort=metadata',
    '/platform/audit?from=2020-01-01',
    '/platform/audit?from=2020-01-01T00:00:00Z&until=2022-01-01T00:00:00Z',
  ])
    await api().get(path).expect(400);
  await api()
    .get('/platform/users/' + randomUUID())
    .expect(404);
  const after = await database!.pool.query<{ n: number }>(
    'select count(*)::int n from public.audit_logs where actor_user_id=$1',
    [demo.accounts.platformOperator.id],
  );
  expect(after.rows[0].n).toBe(tenantAuditBefore);
}, 60000);
