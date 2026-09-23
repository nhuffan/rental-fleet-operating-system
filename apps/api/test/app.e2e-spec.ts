import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/http.js';
import { Database } from '../dist/database/database.js';
import { loadConfig } from '../dist/config.js';
type Account = {
  id: string;
  email: string;
  password: string;
  role: string;
  business: string;
};
const demo = JSON.parse(readFileSync('../../.env.demo.json', 'utf8')) as {
  projectRef: string;
  businessA: string;
  businessB: string;
  branchA: string;
  branchB: string;
  accounts: Record<string, Account>;
};
const tokens: Record<string, string> = {};
let app: INestApplication;
let database: Database;
let createdBranch: string;
let addedMember: string;
function api(actor = 'ownerA', business = demo.businessA) {
  return {
    get: (path: string) =>
      request(app.getHttpServer())
        .get('/api/v1' + path)
        .set('Authorization', 'Bearer ' + tokens[actor])
        .set('X-Business-Id', business),
    patch: (path: string) =>
      request(app.getHttpServer())
        .patch('/api/v1' + path)
        .set('Authorization', 'Bearer ' + tokens[actor])
        .set('X-Business-Id', business),
    post: (path: string) =>
      request(app.getHttpServer())
        .post('/api/v1' + path)
        .set('Authorization', 'Bearer ' + tokens[actor])
        .set('X-Business-Id', business),
  };
}
beforeAll(async () => {
  process.env.LOG_REQUESTS = 'false';
  const c = loadConfig();
  if (
    c.environment !== 'development' ||
    !c.supabaseUrl.includes(demo.projectRef)
  )
    throw Error('Integration tests require the seeded development project');
  for (const [name, a] of Object.entries(demo.accounts)) {
    const client = createClient(c.supabaseUrl, c.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });
    if (error || !data.session) throw Error('Demo login failed: ' + name);
    tokens[name] = data.session.access_token;
  }
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  database = app.get(Database);
}, 60000);
afterAll(async () => {
  if (database) {
    if (createdBranch)
      await database.pool.query(
        'delete from public.branches where id=$1 and business_id=$2',
        [createdBranch, demo.businessA],
      );
    if (addedMember)
      await database.pool.query(
        'delete from public.business_memberships where id=$1 and business_id=$2',
        [addedMember, demo.businessA],
      );
  }
  await app?.close();
});
it('health is public and request IDs/errors are standardized', async () => {
  const r = await request(app.getHttpServer())
    .get('/api/v1/health')
    .expect(200);
  expect(r.body.status).toBe('ok');
  expect(r.headers['x-request-id']).toMatch(/^[\da-f-]{36}$/);
  const denied = await request(app.getHttpServer())
    .get('/api/v1/me')
    .expect(401);
  expect(denied.body.code).toBe('UNAUTHENTICATED');
  expect(denied.body.requestId).toBeTruthy();
  expect(JSON.stringify(denied.body)).not.toContain('Bearer');
});
it('rejects invalid and expired/tampered bearer tokens', async () => {
  for (const token of [
    'not-a-token',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIiwiZXhwIjoxfQ.invalid',
  ])
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(401);
});
it('returns actual user, tenant and role; supports explicit tenant selection', async () => {
  const r = await api().get('/me').expect(200);
  expect(r.body.user.id).toBe(demo.accounts.ownerA.id);
  expect(r.body.business.id).toBe(demo.businessA);
  expect(r.body.role).toBe('OWNER');
  expect(r.body.permissions).toContain('user.manage');
  await api('ownerA', demo.businessB).get('/me').expect(403);
  const b = await api('ownerB', demo.businessB).get('/me').expect(200);
  expect(b.body.business.id).toBe(demo.businessB);
});
it('denies users without an active membership', async () => {
  await api('noMembership').get('/me').expect(403);
  await api('disabledA').get('/me').expect(403);
});
it('isolates branch reads and writes even when UUIDs are known', async () => {
  await api()
    .get('/branches/' + demo.branchA)
    .expect(200);
  await api()
    .get('/branches/' + demo.branchB)
    .expect(404);
  await api()
    .patch('/branches/' + demo.branchB)
    .send({ name: 'forbidden' })
    .expect(404);
  await api('ownerB', demo.businessB)
    .get('/branches/' + demo.branchB)
    .expect(200);
  const r = await api().get('/branches').expect(200);
  expect(
    r.body.data.every(
      (b: { businessId: string }) => b.businessId === demo.businessA,
    ),
  ).toBe(true);
});
it('validates DTOs, rejects tenant injection, malformed pagination and null fields', async () => {
  await api()
    .post('/branches')
    .send({ name: 'x', businessId: demo.businessB })
    .expect(400);
  await api().get('/branches?page=-1').expect(400);
  await api()
    .patch('/settings')
    .send({ config: { tenantId: demo.businessB } })
    .expect(400);
  await api().patch('/businesses/current').send({ name: null }).expect(400);
  await api()
    .patch('/businesses/current')
    .send({ timezone: 'Invalid/Timezone' })
    .expect(400);
});
it('enforces RBAC and audits admin branch/settings changes', async () => {
  await api('operationsA')
    .post('/branches')
    .send({ name: 'denied' })
    .expect(403);
  await api('operationsA').get('/memberships').expect(403);
  const r = await api('adminA')
    .post('/branches')
    .send({ name: 'Integration branch' })
    .expect(201);
  createdBranch = r.body.id;
  await api('adminA')
    .patch('/branches/' + createdBranch)
    .send({ status: 'DISABLED' })
    .expect(200);
  const before = await api().get('/settings').expect(200);
  await api('adminA')
    .patch('/settings')
    .send({ config: { locale: 'vi', dateFormat: 'ISO' } })
    .expect(200);
  await api()
    .patch('/settings')
    .send({ config: before.body.config })
    .expect(200);
  const logs = await database.pool.query(
    'select action,metadata from public.audit_logs where business_id=$1 and entity_id=$2',
    [demo.businessA, createdBranch],
  );
  expect(logs.rows.map((r) => r.action)).toEqual(
    expect.arrayContaining(['branch.create', 'branch.update']),
  );
  expect(logs.rows.every((r) => r.metadata.requestId)).toBe(true);
});
it('prevents owner escalation, last-owner removal and tenant membership IDOR', async () => {
  const members = await api().get('/memberships').expect(200);
  const owner = members.body.data.find(
    (m: { userId: string }) => m.userId === demo.accounts.ownerA.id,
  );
  await api('adminA')
    .patch('/memberships/' + owner.id)
    .send({ roleKey: 'OPERATIONS' })
    .expect(403);
  await api()
    .patch('/memberships/' + owner.id)
    .send({ status: 'DISABLED' })
    .expect(409);
  const other = await api('ownerB', demo.businessB)
    .get('/memberships')
    .expect(200);
  await api()
    .patch('/memberships/' + other.body.data[0].id)
    .send({ status: 'DISABLED' })
    .expect(404);
});
it('adds, changes and disables membership with audit; revoked membership takes effect immediately', async () => {
  const r = await api()
    .post('/memberships')
    .send({ userId: demo.accounts.noMembership.id, roleKey: 'OPERATIONS' })
    .expect(201);
  addedMember = r.body.id;
  await api('noMembership').get('/me').expect(200);
  await api()
    .patch('/memberships/' + addedMember)
    .send({ roleKey: 'ADMIN' })
    .expect(200);
  await api('noMembership').get('/memberships').expect(200);
  await api()
    .patch('/memberships/' + addedMember)
    .send({ status: 'DISABLED' })
    .expect(200);
  await api('noMembership').get('/me').expect(403);
  const logs = await database.pool.query(
    'select action from public.audit_logs where business_id=$1 and entity_id=$2',
    [demo.businessA, addedMember],
  );
  expect(logs.rows).toHaveLength(3);
});
it('enforces tenant RLS and denies direct writes through real Supabase Data API', async () => {
  const c = loadConfig();
  const headers = {
    apikey: c.publishableKey,
    Authorization: 'Bearer ' + tokens.ownerA,
  };
  const r = await fetch(
    c.supabaseUrl + '/rest/v1/branches?select=id,business_id',
    { headers },
  );
  expect(r.status).toBe(200);
  const rows = (await r.json()) as { business_id: string }[];
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => r.business_id === demo.businessA)).toBe(true);
  const forbidden = await fetch(
    c.supabaseUrl + '/rest/v1/branches?id=eq.' + demo.branchB + '&select=id',
    { headers },
  );
  expect(await forbidden.json()).toEqual([]);
  const write = await fetch(c.supabaseUrl + '/rest/v1/branches', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_id: demo.businessA,
      name: 'forbidden Data API write',
    }),
  });
  expect(write.status).toBe(403);
  const anonymous = await fetch(c.supabaseUrl + '/rest/v1/branches?select=id', {
    headers: { apikey: c.publishableKey },
  });
  expect([401, 403]).toContain(anonymous.status);
  const disabled = await fetch(c.supabaseUrl + '/rest/v1/branches?select=id', {
    headers: {
      apikey: c.publishableKey,
      Authorization: 'Bearer ' + tokens.disabledA,
    },
  });
  expect(await disabled.json()).toEqual([]);
});

it('keeps an active owner during concurrent self-disable requests', async () => {
  const members = await api().get('/memberships').expect(200);
  const owner = members.body.data.find(
    (m: { userId: string }) => m.userId === demo.accounts.ownerA.id,
  );
  await api()
    .patch('/memberships/' + addedMember)
    .send({ roleKey: 'OWNER', status: 'ACTIVE' })
    .expect(200);
  try {
    const results = await Promise.all([
      api()
        .patch('/memberships/' + owner.id)
        .send({ status: 'DISABLED' }),
      api('noMembership')
        .patch('/memberships/' + addedMember)
        .send({ status: 'DISABLED' }),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    const remaining = await database.pool.query(
      "select count(*)::int as total from public.business_memberships where business_id=$1 and role_key='OWNER' and status='ACTIVE'",
      [demo.businessA],
    );
    expect(remaining.rows[0].total).toBe(1);
  } finally {
    await database.pool.query(
      "update public.business_memberships set status='ACTIVE' where id=$1 and business_id=$2",
      [owner.id, demo.businessA],
    );
    await database.pool.query(
      "update public.business_memberships set status='DISABLED',role_key='OPERATIONS' where id=$1 and business_id=$2",
      [addedMember, demo.businessA],
    );
  }
});
it('does not trust user metadata and blocks disabled profiles in API and RLS', async () => {
  const c = loadConfig();
  const client = createClient(c.supabaseUrl, c.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const account = demo.accounts.operationsA;
  const { error: loginError } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  expect(loginError).toBeNull();
  const { error } = await client.auth.updateUser({
    data: { role: 'OWNER', business_id: demo.businessB },
  });
  expect(error).toBeNull();
  try {
    await api('operationsA')
      .post('/branches')
      .send({ name: 'metadata must not authorize' })
      .expect(403);
    await database.pool.query(
      "update public.user_profiles set status='DISABLED' where user_id=$1",
      [account.id],
    );
    await api('operationsA').get('/me').expect(403);
    const r = await fetch(c.supabaseUrl + '/rest/v1/branches?select=id', {
      headers: {
        apikey: c.publishableKey,
        Authorization: 'Bearer ' + tokens.operationsA,
      },
    });
    expect(await r.json()).toEqual([]);
  } finally {
    await database.pool.query(
      "update public.user_profiles set status='ACTIVE' where user_id=$1",
      [account.id],
    );
    await client.auth.updateUser({ data: { role: null, business_id: null } });
    await client.auth.signOut();
  }
});
