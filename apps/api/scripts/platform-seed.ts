import { randomBytes, randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/database/database.js';
import {
  assertPlatformSeedEnvironment,
  existingPlatformOperator,
  platformDemo,
  PlatformSeedRefused,
  type DemoAccount,
  type PlatformDemo,
} from './platform-seed-policy.js';

const credentialPath = fileURLToPath(
  new URL('../../../.env.demo.json', import.meta.url),
);
const lockPath = `${credentialPath}.platform.lock`;
function save(data: PlatformDemo) {
  const temporaryPath = `${credentialPath}.platform.tmp`;
  let created = false;
  try {
    writeFileSync(temporaryPath, JSON.stringify(data, null, 2) + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
    created = true;
    renameSync(temporaryPath, credentialPath);
    chmodSync(credentialPath, 0o600);
  } finally {
    if (created && existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}
async function main() {
  const config = loadConfig();
  assertPlatformSeedEnvironment(
    config.environment,
    config.supabaseUrl,
    process.env.ALLOW_DEMO_SEED,
    process.env.SUPABASE_PROJECT_REF,
  );
  if (!existsSync(credentialPath))
    throw new PlatformSeedRefused(
      'Run the normal development demo seed before this dedicated operator bootstrap',
    );
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    throw new PlatformSeedRefused(
      'SUPABASE_SECRET_KEY is required only for this development bootstrap',
    );
  const lock = openSync(lockPath, 'wx', 0o600);
  let pool: ReturnType<typeof createPool> | undefined;
  try {
    pool = createPool();
    const data = platformDemo(JSON.parse(readFileSync(credentialPath, 'utf8')));
    let account = existingPlatformOperator(data);
    const db = await pool.connect();
    try {
      const schema = await db.query<{ installed: string | null }>(
        "select to_regclass('public.platform_memberships')::text as installed",
      );
      if (!schema.rows[0].installed)
        throw new PlatformSeedRefused(
          'Apply the platform migration before bootstrapping an operator',
        );
      const auth = createClient(config.supabaseUrl, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if (account) {
        const tenant = await db.query(
          'select 1 from public.business_memberships where user_id=$1 limit 1',
          [account.id],
        );
        if (tenant.rowCount)
          throw new PlatformSeedRefused(
            'Refusing to promote a tenant member into the dedicated demo operator',
          );
        const lookup = await auth.auth.admin.getUserById(account.id);
        if (
          lookup.error ||
          lookup.data.user?.email?.toLowerCase() !== account.email.toLowerCase()
        )
          throw new PlatformSeedRefused(
            'Saved platform identity no longer matches Auth; refusing to replace or promote another identity',
          );
      } else {
        const password = randomBytes(24).toString('base64url') + 'aA1!';
        const email = `rental-platform-${randomBytes(8).toString('hex')}@example.test`;
        const created = await auth.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (created.error || !created.data.user)
          throw new PlatformSeedRefused(
            'Could not create the dedicated development platform Auth identity',
          );
        account = {
          id: created.data.user.id,
          email,
          password,
          role: 'PLATFORM_OPERATOR',
          business: '',
          status: 'ACTIVE',
        } satisfies DemoAccount;
        // Preserve the generated credential before DB setup, so a failed transaction can be retried safely.
        data.accounts.platformOperator = account;
        save(data);
      }
      await db.query('begin');
      try {
        await db.query(
          "insert into public.user_profiles(user_id,display_name,status) values($1,'Development Platform Operator',$2) on conflict(user_id) do nothing",
          [account.id, account.status],
        );
        await db.query(
          'select user_id from public.user_profiles where user_id=$1 for update',
          [account.id],
        );
        const tenant = await db.query(
          'select 1 from public.business_memberships where user_id=$1 limit 1',
          [account.id],
        );
        if (tenant.rowCount)
          throw new PlatformSeedRefused(
            'Refusing to promote a tenant member into the dedicated demo operator',
          );
        const membership = await db.query<{ id: string }>(
          'insert into public.platform_memberships(user_id,status) values($1,$2) on conflict(user_id) do nothing returning id',
          [account.id, account.status],
        );
        if (membership.rows[0])
          await db.query(
            "insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values($1,'platform_membership.create','platform_membership',$2,$3::jsonb)",
            [
              account.id,
              membership.rows[0].id,
              JSON.stringify({
                requestId: randomUUID(),
                fields: ['userId', 'roleKey', 'status'],
              }),
            ],
          );
        await db.query('commit');
      } catch (error) {
        await db.query('rollback');
        throw error;
      }
      console.log(
        'Dedicated development platform operator prepared. Credentials are in ignored .env.demo.json at accounts.platformOperator. Tenant accounts and disabled profile/membership states were preserved; no credentials printed.',
      );
    } finally {
      db.release();
    }
  } finally {
    try {
      await pool?.end();
    } finally {
      closeSync(lock);
      unlinkSync(lockPath);
    }
  }
}
try {
  await main();
} catch (error) {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  console.error(
    JSON.stringify({
      event: 'platform.seed.failed',
      errorType: /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(name)
        ? name
        : 'UnknownError',
      errorCode:
        typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code)
          ? code
          : undefined,
      reason:
        error instanceof PlatformSeedRefused
          ? error.message
          : 'Bootstrap failed; inspect local configuration without printing credentials',
    }),
  );
  process.exitCode = 1;
}
