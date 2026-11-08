import {
  runRetention,
  RETENTION_BATCH_CAP,
} from '../telematics/operations/retention.js';

export type JobMode = 'off' | 'dry-run' | 'apply';
export type JobConfig = {
  enabled: boolean;
  intervalMs: number;
  gps: JobMode;
  evidence: JobMode;
  maxTenantsPerRun: number;
};
export type JobResult = {
  job: 'gps_retention' | 'evidence_retention';
  mode: JobMode;
  outcome: 'ok' | 'failed' | 'skipped';
  counts: Record<string, number>;
};

const MODES: readonly string[] = ['off', 'dry-run', 'apply'];
function mode(value: string | undefined): JobMode {
  const v = (value ?? 'off').trim().toLowerCase();
  if (!MODES.includes(v)) throw new Error('Invalid job mode');
  return v as JobMode;
}
/** Background jobs are OFF unless JOBS_ENABLED=true, and each job defaults to off. */
export function jobConfig(env: Record<string, string | undefined>): JobConfig {
  const minutes = Number(env.JOB_INTERVAL_MINUTES ?? 60);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440)
    throw new Error('Invalid JOB_INTERVAL_MINUTES');
  const maxTenants = Number(env.JOB_MAX_TENANTS_PER_RUN ?? 200);
  if (!Number.isInteger(maxTenants) || maxTenants < 1 || maxTenants > 5000)
    throw new Error('Invalid JOB_MAX_TENANTS_PER_RUN');
  return {
    enabled: env.JOBS_ENABLED === 'true',
    intervalMs: minutes * 60_000,
    gps: mode(env.JOB_GPS_RETENTION),
    evidence: mode(env.JOB_EVIDENCE_RETENTION),
    maxTenantsPerRun: maxTenants,
  };
}

export interface JobPool {
  connect(): Promise<{
    query<R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: R[]; rowCount?: number | null }>;
    release(): void;
  }>;
}
export const JOB_LOCK_KEY = 190030;
/** One instance at a time: a session advisory lock on a dedicated connection. */
export async function runExclusive<T>(
  pool: JobPool,
  fn: () => Promise<T>,
): Promise<{ ran: boolean; value?: T }> {
  const lock = await pool.connect();
  try {
    const got = await lock.query<{ locked: boolean }>(
      'select pg_try_advisory_lock($1) as locked',
      [JOB_LOCK_KEY],
    );
    if (!got.rows[0]?.locked) return { ran: false };
    try {
      return { ran: true, value: await fn() };
    } finally {
      await lock.query('select pg_advisory_unlock($1)', [JOB_LOCK_KEY]);
    }
  } finally {
    lock.release();
  }
}

export type JobDeps = {
  pool: JobPool;
  config: JobConfig;
  evidence: {
    runBatch(o: {
      apply?: boolean;
      limit?: number;
    }): Promise<Record<string, unknown>>;
  };
  deletionEnabled: () => boolean;
  gpsRetention?: typeof runRetention;
  log?: (event: Record<string, unknown>) => void;
};
const numbers = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    ),
  );

/** Only counts and job names are logged: never tenant IDs, device IDs or media paths. */
export async function runMaintenanceJobs(deps: JobDeps): Promise<JobResult[]> {
  const log = deps.log ?? ((e) => console.log(JSON.stringify(e)));
  const results: JobResult[] = [];
  const record = (r: JobResult) => {
    results.push(r);
    log({ event: 'job.run', ...r });
  };
  if (deps.config.gps !== 'off') {
    const apply = deps.config.gps === 'apply';
    try {
      const tenants = await deps.pool.connect();
      let ids: string[] = [];
      try {
        ids = (
          await tenants.query<{ id: string }>(
            "select id from public.businesses where status='ACTIVE' order by id limit $1",
            [deps.config.maxTenantsPerRun],
          )
        ).rows.map((r) => r.id);
      } finally {
        tenants.release();
      }
      const run = deps.gpsRetention ?? runRetention;
      const totals = { tenants: 0, eligible: 0, deleted: 0, failures: 0 };
      for (const businessId of ids) {
        try {
          const r = await run(deps.pool as never, {
            businessId,
            apply,
            batchLimit: RETENTION_BATCH_CAP,
            maxBatches: apply ? 3 : 1,
          });
          totals.tenants++;
          totals.eligible += r.eligible;
          totals.deleted += r.deleted;
        } catch {
          totals.failures++;
        }
      }
      record({
        job: 'gps_retention',
        mode: deps.config.gps,
        outcome: totals.failures ? 'failed' : 'ok',
        counts: totals,
      });
    } catch {
      record({ job: 'gps_retention', mode: deps.config.gps, outcome: 'failed', counts: {} });
    }
  }
  if (deps.config.evidence !== 'off') {
    const apply = deps.config.evidence === 'apply';
    // Irreversible deletion needs the separate typed enablement; otherwise skip, never downgrade silently.
    if (apply && !deps.deletionEnabled())
      record({ job: 'evidence_retention', mode: 'apply', outcome: 'skipped', counts: {} });
    else
      try {
        const r = await deps.evidence.runBatch({ apply, limit: 50 });
        const counts = numbers(r);
        record({
          job: 'evidence_retention',
          mode: deps.config.evidence,
          outcome: counts.failed || counts.retryRequired ? 'failed' : 'ok',
          counts,
        });
      } catch {
        record({ job: 'evidence_retention', mode: deps.config.evidence, outcome: 'failed', counts: {} });
      }
  }
  return results;
}
