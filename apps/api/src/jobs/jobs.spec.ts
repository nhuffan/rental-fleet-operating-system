import 'reflect-metadata';
import {
  jobConfig,
  runExclusive,
  runMaintenanceJobs,
  type JobConfig,
  type JobPool,
} from './jobs.js';
import { JobScheduler } from './job-scheduler.js';
import type { Database } from '../database/database.js';
import type { EvidenceRetentionWorker } from '../evidence/retention-worker.js';

const base = (extra: Partial<JobConfig> = {}): JobConfig => ({
  enabled: true,
  intervalMs: 300_000,
  gps: 'off',
  evidence: 'off',
  maxTenantsPerRun: 10,
  ...extra,
});
/** A fake pool with one shared advisory-lock table, like separate connections to one database. */
function fakePool(tenants: string[] = ['t1', 't2']) {
  const locks = new Set<number>();
  const pool: JobPool = {
    async connect() {
      const mine = new Set<number>();
      return {
        async query(text: string, values?: unknown[]) {
          if (text.includes('pg_try_advisory_lock')) {
            const key = values![0] as number;
            const free = !locks.has(key);
            if (free) {
              locks.add(key);
              mine.add(key);
            }
            return { rows: [{ locked: free } as never] };
          }
          if (text.includes('pg_advisory_unlock')) {
            locks.delete(values![0] as number);
            return { rows: [] };
          }
          if (text.includes('from public.businesses'))
            return { rows: tenants.map((id) => ({ id })) as never[] };
          throw new Error('unexpected query');
        },
        release() {
          for (const key of mine) locks.delete(key);
        },
      };
    },
  };
  return { pool, locks };
}

describe('job configuration', () => {
  it('is off by default and validates bounds and modes', () => {
    expect(jobConfig({})).toMatchObject({ enabled: false, gps: 'off', evidence: 'off' });
    expect(
      jobConfig({
        JOBS_ENABLED: 'true',
        JOB_GPS_RETENTION: 'dry-run',
        JOB_EVIDENCE_RETENTION: 'APPLY',
        JOB_INTERVAL_MINUTES: '15',
      }),
    ).toMatchObject({ enabled: true, gps: 'dry-run', evidence: 'apply', intervalMs: 900_000 });
    for (const env of [
      { JOB_GPS_RETENTION: 'delete' },
      { JOB_INTERVAL_MINUTES: '1' },
      { JOB_INTERVAL_MINUTES: 'x' },
      { JOB_MAX_TENANTS_PER_RUN: '0' },
    ])
      expect(() => jobConfig(env)).toThrow();
  });
});

describe('exclusive execution', () => {
  it('runs one instance at a time and releases the lock afterwards', async () => {
    const { pool, locks } = fakePool();
    let inner: Awaited<ReturnType<typeof runExclusive>> | undefined;
    const outer = await runExclusive(pool, async () => {
      inner = await runExclusive(pool, async () => 'second');
      return 'first';
    });
    expect(outer).toEqual({ ran: true, value: 'first' });
    expect(inner).toEqual({ ran: false });
    expect(locks.size).toBe(0);
    expect(await runExclusive(pool, async () => 'again')).toEqual({ ran: true, value: 'again' });
  });
  it('releases the lock when the job throws', async () => {
    const { pool, locks } = fakePool();
    await expect(
      runExclusive(pool, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(locks.size).toBe(0);
  });
});

describe('maintenance jobs', () => {
  const events: Record<string, unknown>[] = [];
  const log = (e: Record<string, unknown>) => events.push(e);
  beforeEach(() => (events.length = 0));
  const evidence = (result: Record<string, unknown> = { eligible: 2, purged: 0, failed: 0, retryRequired: 0 }) => ({
    runBatch: vi.fn(async () => result),
  });

  it('does nothing when every job is off', async () => {
    const e = evidence();
    expect(
      await runMaintenanceJobs({ pool: fakePool().pool, config: base(), evidence: e, deletionEnabled: () => true, log }),
    ).toEqual([]);
    expect(e.runBatch).not.toHaveBeenCalled();
  });
  it('runs GPS retention per active tenant as dry-run or bounded apply, logging counts only', async () => {
    const gps = vi.fn(async (..._args: unknown[]) => ({ eligible: 5, deleted: 3 }) as never);
    const results = await runMaintenanceJobs({
      pool: fakePool().pool,
      config: base({ gps: 'apply' }),
      evidence: evidence(),
      deletionEnabled: () => true,
      gpsRetention: gps,
      log,
    });
    expect(gps).toHaveBeenCalledTimes(2);
    expect(gps.mock.calls[0][1]).toMatchObject({ apply: true, maxBatches: 3, batchLimit: 1000 });
    expect(results[0]).toMatchObject({
      job: 'gps_retention',
      outcome: 'ok',
      counts: { tenants: 2, eligible: 10, deleted: 6, failures: 0 },
    });
    const dry = vi.fn(async (..._args: unknown[]) => ({ eligible: 1, deleted: 0 }) as never);
    await runMaintenanceJobs({
      pool: fakePool().pool, config: base({ gps: 'dry-run' }), evidence: evidence(),
      deletionEnabled: () => true, gpsRetention: dry, log,
    });
    expect(dry.mock.calls[0][1]).toMatchObject({ apply: false, maxBatches: 1 });
    const logged = JSON.stringify(events);
    expect(logged).not.toContain('t1');
    expect(logged).not.toContain('businessId');
  });
  it('isolates one tenant failure and reports the run as failed', async () => {
    let call = 0;
    const gps = vi.fn(async () => {
      if (++call === 1) throw new Error('db down for tenant');
      return { eligible: 1, deleted: 0 } as never;
    });
    const [result] = await runMaintenanceJobs({
      pool: fakePool().pool, config: base({ gps: 'dry-run' }), evidence: evidence(),
      deletionEnabled: () => true, gpsRetention: gps, log,
    });
    expect(result).toMatchObject({ outcome: 'failed', counts: { tenants: 1, failures: 1 } });
    expect(JSON.stringify(events)).not.toContain('db down');
  });
  it('skips evidence apply unless irreversible deletion is separately enabled', async () => {
    const e = evidence();
    const [skipped] = await runMaintenanceJobs({
      pool: fakePool().pool, config: base({ evidence: 'apply' }), evidence: e,
      deletionEnabled: () => false, log,
    });
    expect(skipped).toMatchObject({ job: 'evidence_retention', outcome: 'skipped' });
    expect(e.runBatch).not.toHaveBeenCalled();
    const [applied] = await runMaintenanceJobs({
      pool: fakePool().pool, config: base({ evidence: 'apply' }), evidence: e,
      deletionEnabled: () => true, log,
    });
    expect(applied.outcome).toBe('ok');
    expect(e.runBatch).toHaveBeenCalledWith({ apply: true, limit: 50 });
    await runMaintenanceJobs({
      pool: fakePool().pool, config: base({ evidence: 'dry-run' }), evidence: e,
      deletionEnabled: () => false, log,
    });
    expect(e.runBatch).toHaveBeenLastCalledWith({ apply: false, limit: 50 });
  });
});

describe('JobScheduler', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('reports off status by default and never starts a timer', async () => {
    vi.stubEnv('JOBS_ENABLED', 'false');
    const scheduler = new JobScheduler(
      { pool: fakePool().pool } as unknown as Database,
      { runBatch: vi.fn() } as unknown as EvidenceRetentionWorker,
    );
    scheduler.onModuleInit();
    expect(scheduler.status()).toMatchObject({ enabled: false });
    expect(scheduler.status().jobs.every((j) => j.mode === 'off' && j.lastRunAt === null)).toBe(true);
    await scheduler.onModuleDestroy();
  });
  it('treats invalid configuration as disabled and records the last outcome after a tick', async () => {
    vi.stubEnv('JOBS_ENABLED', 'true');
    vi.stubEnv('JOB_GPS_RETENTION', 'bogus');
    const off = new JobScheduler(
      { pool: fakePool().pool } as unknown as Database,
      { runBatch: vi.fn() } as unknown as EvidenceRetentionWorker,
    );
    expect(off.status().enabled).toBe(false);
    vi.stubEnv('JOB_GPS_RETENTION', 'off');
    vi.stubEnv('JOB_EVIDENCE_RETENTION', 'dry-run');
    const runBatch = vi.fn(async () => ({ eligible: 0, purged: 0, failed: 0, retryRequired: 0 }));
    const on = new JobScheduler(
      { pool: fakePool().pool } as unknown as Database,
      { runBatch } as unknown as EvidenceRetentionWorker,
    );
    await on.tick();
    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(on.status().jobs.find((j) => j.key === 'evidence_retention')).toMatchObject({
      mode: 'dry-run',
      lastOutcome: 'ok',
    });
  });
});
