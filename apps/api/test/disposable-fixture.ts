import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createPool } from '../dist/database/database.js';
import { loadConfig } from '../dist/config.js';

const DEVELOPMENT_PROJECT = 'eeryymswcufnebibigqf';
type Account = { id: string; email: string; password: string };

/** Each suite owns its Auth identities and tenants. Never read personal login files. */
export function disposableFixture() {
  const runId = randomUUID();
  const data: {
    projectRef: string;
    businessA: string;
    businessB: string;
    branchA: string;
    branchB: string;
    accounts: Record<string, Account>;
  } = {
    projectRef: DEVELOPMENT_PROJECT,
    businessA: randomUUID(),
    businessB: randomUUID(),
    branchA: randomUUID(),
    branchB: randomUUID(),
    accounts: {},
  };
  const tokens: Record<string, string> = {};
  const ownedBusinesses: string[] = [];
  const ownedAccounts = new Set<string>();
  let started = false;
  const config = () => {
    const c = loadConfig();
    if (
      c.environment !== 'development' ||
      process.env.ALLOW_DEMO_SEED !== 'true' ||
      new URL(c.supabaseUrl).hostname !== DEVELOPMENT_PROJECT + '.supabase.co'
    )
      throw new Error(
        'Disposable E2E requires the exact development project and ALLOW_DEMO_SEED=true',
      );
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret)
      throw new Error(
        'Disposable E2E requires server-side SUPABASE_SECRET_KEY',
      );
    return { ...c, secret };
  };
  async function cleanup() {
    if (!ownedBusinesses.length && !ownedAccounts.size) return;
    const c = config();
    const admin = createClient(c.supabaseUrl, c.secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const failures: string[] = [];
    const pool = createPool();
    try {
      const db = await pool.connect();
      try {
        await db.query('begin');
        const ids = [ownedBusinesses];
        // Every row in these run-created tenants belongs to this suite, including
        // successful writes whose response was lost before an individual ID was recorded.
        for (const table of [
          'commercial_movements',
          'gps_positions',
          'rentals',
          'device_assignments',
          'vehicles',
          'gps_devices',
          'customers',
          'branches',
          'business_settings',
          'business_memberships',
        ])
          await db.query(
            `delete from public.${table} where business_id=any($1::uuid[])`,
            ids,
          );
        const users = [...ownedAccounts];
        await db.query(
          "update public.user_profiles set status='DISABLED' where user_id=any($1::uuid[])",
          [users],
        );
        await db.query(
          'delete from public.platform_memberships where user_id=any($1::uuid[])',
          [users],
        );
        // Tenant audit has a business FK. Retain only a disabled tenant tombstone
        // where evidence exists; never delete audit events or change their actor refs.
        await db.query(
          "update public.businesses set status='DISABLED',name=$2 where id=any($1::uuid[])",
          [ownedBusinesses, 'E2E retired ' + runId],
        );
        await db.query(
          'delete from public.businesses b where b.id=any($1::uuid[]) and not exists(select 1 from public.audit_logs a where a.business_id=b.id)',
          ids,
        );
        await db.query('commit');
        ownedBusinesses.length = 0;
      } catch {
        await db.query('rollback');
        throw new Error('Domain cleanup failed');
      } finally {
        db.release();
      }
    } catch {
      failures.push('domain cleanup');
    } finally {
      await pool.end();
    }
    for (const id of ownedAccounts) {
      const actor = Object.keys(data.accounts).find(
        (key) => data.accounts[key].id === id,
      );
      try {
        if (actor && tokens[actor]) {
          const revoked = await admin.auth.admin.signOut(
            tokens[actor],
            'global',
          );
          if (
            revoked.error &&
            ![401, 403, 404].includes(revoked.error.status ?? 0)
          )
            failures.push('session revocation');
        }
        const removed = await admin.auth.admin.deleteUser(id);
        if (removed.error) failures.push('Auth cleanup');
        else ownedAccounts.delete(id);
      } catch {
        failures.push('Auth cleanup');
      }
    }
    if (failures.length)
      throw new Error(
        'Disposable E2E cleanup incomplete (' +
          failures.length +
          ' steps); no unrelated IDs were touched',
      );
  }
  async function start() {
    if (started) throw new Error('Disposable fixture cannot be started twice');
    started = true;
    const c = config();
    const admin = createClient(c.supabaseUrl, c.secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      for (const actor of [
        'ownerA',
        'ownerB',
        'disabledA',
        'noMembership',
        'platformOperator',
      ]) {
        const email = `rental-e2e-${actor.toLowerCase()}-${runId}@example.test`;
        const password = randomBytes(24).toString('base64url') + 'aA1!';
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (created.error || !created.data.user)
          throw new Error('Could not create disposable Auth identity');
        const id = created.data.user.id;
        ownedAccounts.add(id);
        data.accounts[actor] = { id, email, password };
      }
      const pool = createPool();
      try {
        const db = await pool.connect();
        try {
          await db.query('begin');
          for (const [id, label] of [
            [data.businessA, 'A'],
            [data.businessB, 'B'],
          ]) {
            await db.query(
              'insert into public.businesses(id,name) values($1,$2)',
              [id, `E2E ${runId} ${label}`],
            );
            ownedBusinesses.push(id);
            await db.query(
              'insert into public.business_settings(business_id) values($1)',
              [id],
            );
          }
          for (const [actor, account] of Object.entries(data.accounts)) {
            await db.query(
              'insert into public.user_profiles(user_id,display_name) values($1,$2)',
              [account.id, 'E2E ' + actor],
            );
            if (['ownerA', 'ownerB', 'disabledA'].includes(actor))
              await db.query(
                "insert into public.business_memberships(business_id,user_id,role_key,status) values($1,$2,'OWNER',$3)",
                [
                  actor === 'ownerB' ? data.businessB : data.businessA,
                  account.id,
                  actor === 'disabledA' ? 'DISABLED' : 'ACTIVE',
                ],
              );
          }
          await db.query(
            "insert into public.platform_memberships(user_id,role_key) values($1,'PLATFORM_OPERATOR')",
            [data.accounts.platformOperator.id],
          );
          for (const [id, businessId] of [
            [data.branchA, data.businessA],
            [data.branchB, data.businessB],
          ])
            await db.query(
              'insert into public.branches(id,business_id,name) values($1,$2,$3)',
              [id, businessId, 'E2E branch'],
            );
          await db.query('commit');
        } catch {
          await db.query('rollback');
          throw new Error('Could not create disposable database fixtures');
        } finally {
          db.release();
        }
      } finally {
        await pool.end();
      }
      for (const [actor, account] of Object.entries(data.accounts)) {
        const client = createClient(c.supabaseUrl, c.publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const login = await client.auth.signInWithPassword({
          email: account.email,
          password: account.password,
        });
        if (login.error || !login.data.session)
          throw new Error('Could not sign into disposable Auth identity');
        tokens[actor] = login.data.session.access_token;
      }
    } catch {
      await cleanup();
      throw new Error(
        'Disposable E2E setup failed; owned fixtures were cleaned',
      );
    }
  }
  return { data, tokens, start, cleanup };
}
