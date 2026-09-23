import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/database/database.js';
const config = loadConfig();
if (
  config.environment !== 'development' ||
  process.env.ALLOW_DEMO_SEED !== 'true'
)
  throw new Error(
    'Demo seed requires APP_ENV=development and ALLOW_DEMO_SEED=true',
  );
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error('SUPABASE_SECRET_KEY is required for seed only');
const client = createClient(config.supabaseUrl, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const path = '../../.env.demo.json';
type Account = {
  email: string;
  password: string;
  id: string;
  role: string;
  business: string;
  status: string;
};
type Demo = {
  projectRef: string;
  businessA: string;
  businessB: string;
  branchA: string;
  branchB: string;
  accounts: Record<string, Account>;
};
const ref = new URL(config.supabaseUrl).hostname.split('.')[0];
const data: Demo = existsSync(path)
  ? (JSON.parse(readFileSync(path, 'utf8')) as Demo)
  : {
      projectRef: ref,
      businessA: randomUUID(),
      businessB: randomUUID(),
      branchA: randomUUID(),
      branchB: randomUUID(),
      accounts: {},
    };
if (data.projectRef !== ref)
  throw new Error('Demo credentials belong to a different Supabase project');
function save() {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}
const definitions = {
  ownerA: ['OWNER', data.businessA, 'ACTIVE'],
  ownerB: ['OWNER', data.businessB, 'ACTIVE'],
  adminA: ['ADMIN', data.businessA, 'ACTIVE'],
  operationsA: ['OPERATIONS', data.businessA, 'ACTIVE'],
  disabledA: ['OPERATIONS', data.businessA, 'DISABLED'],
  noMembership: ['OPERATIONS', '', 'ACTIVE'],
};
for (const [name, [role, business, status]] of Object.entries(definitions)) {
  if (data.accounts[name]) continue;
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const email = `rental-${name.toLowerCase()}-${randomBytes(5).toString('hex')}@example.test`;
  const { data: result, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !result.user)
    throw new Error(
      `Could not create demo user ${name}: ${error?.code ?? 'unknown'} (HTTP ${error?.status ?? 'unknown'}) ${error?.message ?? ''}`,
    );
  data.accounts[name] = {
    id: result.user.id,
    email,
    password,
    role,
    business,
    status,
  };
  save();
}
const pool = createPool();
const db = await pool.connect();
try {
  await db.query('begin');
  for (const [id, name] of [
    [data.businessA, 'Demo Rental A'],
    [data.businessB, 'Demo Rental B'],
  ]) {
    await db.query(
      'insert into public.businesses(id,name) values($1,$2) on conflict(id) do nothing',
      [id, name],
    );
    await db.query(
      'insert into public.business_settings(business_id) values($1) on conflict do nothing',
      [id],
    );
  }
  for (const [name, a] of Object.entries(data.accounts)) {
    await db.query(
      'insert into public.user_profiles(user_id,display_name) values($1,$2) on conflict do nothing',
      [a.id, name],
    );
    if (a.business)
      await db.query(
        'insert into public.business_memberships(business_id,user_id,role_key,status) values($1,$2,$3,$4) on conflict(business_id,user_id) do nothing',
        [a.business, a.id, a.role, a.status],
      );
  }
  for (const [id, business, name] of [
    [data.branchA, data.businessA, 'Ho Chi Minh City'],
    [data.branchB, data.businessB, 'Da Nang'],
  ])
    await db.query(
      'insert into public.branches(id,business_id,name) values($1,$2,$3) on conflict(id) do nothing',
      [id, business, name],
    );
  await db.query('commit');
  console.log(
    'Demo tenants seeded. Login credentials saved to ignored .env.demo.json; no passwords printed and no emails sent.',
  );
} catch (e) {
  await db.query('rollback');
  throw e;
} finally {
  db.release();
  await pool.end();
}
