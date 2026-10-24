import {
  Inject,
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { EvidenceService } from './evidence.service.js';
/** Bounded janitor on API instances; tenant locks make overlapping replicas safe. */
@Injectable()
export class EvidenceCleanup implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(
    @Inject(EvidenceService) private readonly evidence: EvidenceService,
  ) {}
  onModuleInit() {
    if (!process.env.SUPABASE_SECRET_KEY) return;
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = this.evidence
        .cleanupExpired(100)
        .then(() => undefined)
        .catch(() => {
          console.warn(
            JSON.stringify({ event: 'inspection.evidence.cleanup_failed' }),
          );
        })
        .finally(() => {
          this.running = undefined;
        });
    }, 15 * 60_000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
}
