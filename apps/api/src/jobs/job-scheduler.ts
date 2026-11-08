import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Database } from '../database/database.js';
import { EvidenceRetentionWorker } from '../evidence/retention-worker.js';
import { retentionDeletionEnabled } from '../evidence/retention-policy.js';
import {
  jobConfig,
  runExclusive,
  runMaintenanceJobs,
  type JobConfig,
  type JobResult,
} from './jobs.js';

export type JobStatus = {
  key: string;
  label: string;
  mode: string;
  lastRunAt: string | null;
  lastOutcome: string | null;
};
const LABELS = {
  gps_retention: 'Dọn bản tin GPS quá hạn',
  evidence_retention: 'Xóa ảnh/video hết hạn lưu giữ',
} as const;

/** Bounded in-process scheduler; OFF unless JOBS_ENABLED=true. The advisory lock lets
 * several API replicas run it safely, and a run never overlaps the previous one. */
@Injectable()
export class JobScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private config?: JobConfig;
  private last = new Map<string, { at: string; outcome: string }>();
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(EvidenceRetentionWorker)
    private readonly evidence: EvidenceRetentionWorker,
  ) {}
  private load() {
    try {
      return (this.config ??= jobConfig(process.env));
    } catch {
      // Invalid configuration disables jobs rather than guessing.
      console.warn(JSON.stringify({ event: 'job.config_invalid' }));
      return (this.config = {
        enabled: false,
        intervalMs: 0,
        gps: 'off',
        evidence: 'off',
        maxTenantsPerRun: 1,
      });
    }
  }
  onModuleInit() {
    const config = this.load();
    if (!config.enabled) return;
    this.timer = setInterval(() => void this.tick(), config.intervalMs);
    this.timer.unref();
  }
  /** One non-overlapping run; exposed for tests and operators. */
  tick(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async run() {
    const config = this.load();
    try {
      const outcome = await runExclusive(this.database.pool, () =>
        runMaintenanceJobs({
          pool: this.database.pool,
          config,
          evidence: this.evidence,
          deletionEnabled: retentionDeletionEnabled,
        }),
      );
      const at = new Date().toISOString();
      for (const r of outcome.value ?? ([] as JobResult[]))
        this.last.set(r.job, { at, outcome: r.outcome });
    } catch {
      console.warn(JSON.stringify({ event: 'job.run_failed' }));
    }
  }
  status(): { enabled: boolean; jobs: JobStatus[] } {
    const config = this.load();
    return {
      enabled: config.enabled,
      jobs: (['gps_retention', 'evidence_retention'] as const).map((key) => {
        const last = this.last.get(key);
        return {
          key,
          label: LABELS[key],
          mode: config.enabled
            ? config[key === 'gps_retention' ? 'gps' : 'evidence']
            : 'off',
          lastRunAt: last?.at ?? null,
          lastOutcome: last?.outcome ?? null,
        };
      }),
    };
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
}
