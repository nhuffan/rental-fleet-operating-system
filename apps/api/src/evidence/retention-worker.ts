import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  rentals,
  evidenceAttachments,
  evidenceUploads,
  evidenceLifecycles,
  evidenceRentalHolds,
  evidenceRetentionSettings,
  evidenceRetentionEvents,
} from '../database/schema.js';
import { EvidenceStorage } from './storage.js';
import { mediaCap } from './config.js';
import {
  retentionBackoff,
  retentionDeadline,
  retentionDeletionEnabled,
} from './retention-policy.js';
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Lifecycle = typeof evidenceLifecycles.$inferSelect;
const LEASE_MS = 90_000;
const clock = async (tx: Tx) =>
  new Date(
    (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text now`))
      .rows[0].now,
  );
@Injectable()
export class EvidenceRetentionWorker {
  private readonly storage = new EvidenceStorage();
  constructor(@Inject(Database) private readonly database: Database) {}
  private async lock(tx: Tx, businessId: string) {
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .for('update');
    return business;
  }
  private async record(tx: Tx, businessId: string, id: string) {
    const [value] = await tx
      .select({
        lifecycle: evidenceLifecycles,
        evidence: evidenceAttachments,
        rental: rentals,
        upload: evidenceUploads,
      })
      .from(evidenceLifecycles)
      .innerJoin(
        evidenceAttachments,
        and(
          eq(evidenceAttachments.id, evidenceLifecycles.evidenceId),
          eq(evidenceAttachments.businessId, businessId),
        ),
      )
      .innerJoin(
        rentals,
        and(
          eq(rentals.id, evidenceLifecycles.rentalId),
          eq(rentals.businessId, businessId),
        ),
      )
      .innerJoin(
        evidenceUploads,
        and(
          eq(evidenceUploads.id, evidenceLifecycles.evidenceId),
          eq(evidenceUploads.businessId, businessId),
        ),
      )
      .where(
        and(
          eq(evidenceLifecycles.businessId, businessId),
          eq(evidenceLifecycles.evidenceId, id),
        ),
      );
    return value;
  }
  private async eligible(
    tx: Tx,
    value: NonNullable<Awaited<ReturnType<EvidenceRetentionWorker['record']>>>,
    now: Date,
  ) {
    const [setting] = await tx
      .select()
      .from(evidenceRetentionSettings)
      .where(
        eq(evidenceRetentionSettings.businessId, value.evidence.businessId),
      );
    const [hold] = await tx
      .select()
      .from(evidenceRentalHolds)
      .where(
        and(
          eq(evidenceRentalHolds.businessId, value.evidence.businessId),
          eq(evidenceRentalHolds.rentalId, value.evidence.rentalId),
        ),
      );
    const deadline = retentionDeadline(
      value.rental,
      setting?.retentionDays ?? 30,
    );
    return (
      value.upload.status === 'ATTACHED' &&
      value.lifecycle.status !== 'PURGED' &&
      !value.lifecycle.important &&
      !hold?.active &&
      !hold?.unresolvedDispute &&
      !!deadline &&
      deadline <= now
    );
  }
  private async event(tx: Tx, row: Lifecycle, action: string, now: Date) {
    await tx.insert(evidenceRetentionEvents).values({
      businessId: row.businessId,
      rentalId: row.rentalId,
      evidenceId: row.evidenceId,
      action,
      actorId: null,
      reason: null,
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      businessId: row.businessId,
      actorUserId: '00000000-0000-0000-0000-000000000000',
      entityType: 'inspection_evidence',
      entityId: row.evidenceId,
      action: `inspection.evidence.${action.toLowerCase()}`,
      metadata: {
        actorType: 'SYSTEM',
        fields: ['retentionStatus'],
        requestId: randomUUID(),
      },
    });
  }
  private async claim(businessId: string, id: string) {
    return this.database.db.transaction(async (tx) => {
      const business = await this.lock(tx, businessId);
      const value = await this.record(tx, businessId, id);
      const now = await clock(tx);
      if (
        business?.status !== 'ACTIVE' ||
        !value ||
        !(await this.eligible(tx, value, now))
      )
        return null;
      const row = value.lifecycle;
      if (
        (row.status === 'PURGING' && row.leaseUntil && row.leaseUntil > now) ||
        (row.status === 'RETRY_REQUIRED' &&
          row.nextRetryAt &&
          row.nextRetryAt > now)
      )
        return null;
      if (
        !['ACTIVE', 'PURGE_ELIGIBLE', 'PURGING', 'RETRY_REQUIRED'].includes(
          row.status,
        )
      )
        return null;
      if (row.status === 'ACTIVE') {
        await tx
          .update(evidenceLifecycles)
          .set({ status: 'PURGE_ELIGIBLE', updatedAt: now })
          .where(
            and(
              eq(evidenceLifecycles.businessId, businessId),
              eq(evidenceLifecycles.evidenceId, id),
            ),
          );
        await this.event(tx, row, 'PURGE_ELIGIBLE', now);
      }
      const leaseId = randomUUID();
      await tx
        .update(evidenceLifecycles)
        .set({
          status: 'PURGING',
          leaseId,
          leaseUntil: new Date(+now + LEASE_MS),
          nextRetryAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(evidenceLifecycles.businessId, businessId),
            eq(evidenceLifecycles.evidenceId, id),
          ),
        );
      await this.event(tx, row, 'PURGE_CLAIMED', now);
      return { businessId, id, leaseId };
    });
  }
  private async purge(claim: {
    businessId: string;
    id: string;
    leaseId: string;
  }): Promise<'purged' | 'retry' | 'skipped'> {
    return this.database.db.transaction(async (tx) => {
      const business = await this.lock(tx, claim.businessId);
      const value = await this.record(tx, claim.businessId, claim.id);
      const now = await clock(tx);
      if (
        !value ||
        value.lifecycle.status !== 'PURGING' ||
        value.lifecycle.leaseId !== claim.leaseId
      )
        return 'skipped';
      if (
        business?.status !== 'ACTIVE' ||
        !retentionDeletionEnabled() ||
        !(await this.eligible(tx, value, now))
      ) {
        // Never reopen an uncertain prior attempt as readable. Hold/policy
        // mutations reject in-flight rows; direct administrative changes also fail closed.
        await tx
          .update(evidenceLifecycles)
          .set({
            status: 'RETRY_REQUIRED',
            leaseId: null,
            leaseUntil: null,
            lastErrorCode: 'STORAGE_DELETE_FAILED',
            nextRetryAt: new Date(+now + 60_000),
            updatedAt: now,
          })
          .where(
            and(
              eq(evidenceLifecycles.businessId, claim.businessId),
              eq(evidenceLifecycles.evidenceId, claim.id),
            ),
          );
        await this.event(tx, value.lifecycle, 'PURGE_CANCELLED', now);
        return 'skipped';
      }
      // Keep the tenant lock until Storage acknowledges deletion and the
      // tombstone/audit commit. A racing hold can never falsely report success.
      try {
        await this.storage.remove(value.evidence.bucket, [
          value.evidence.objectKey,
        ]);
      } catch {
        const attempts = Math.min(1000, value.lifecycle.retryCount + 1);
        await tx
          .update(evidenceLifecycles)
          .set({
            status: 'RETRY_REQUIRED',
            leaseId: null,
            leaseUntil: null,
            retryCount: attempts,
            nextRetryAt: new Date(+now + retentionBackoff(attempts)),
            lastErrorCode: 'STORAGE_DELETE_FAILED',
            updatedAt: now,
          })
          .where(
            and(
              eq(evidenceLifecycles.businessId, claim.businessId),
              eq(evidenceLifecycles.evidenceId, claim.id),
            ),
          );
        await this.event(tx, value.lifecycle, 'PURGE_RETRY', now);
        return 'retry';
      }
      const finished = await clock(tx);
      await tx
        .update(evidenceLifecycles)
        .set({
          status: 'PURGED',
          purgedAt: finished,
          leaseId: null,
          leaseUntil: null,
          nextRetryAt: null,
          lastErrorCode: null,
          updatedAt: finished,
        })
        .where(
          and(
            eq(evidenceLifecycles.businessId, claim.businessId),
            eq(evidenceLifecycles.evidenceId, claim.id),
          ),
        );
      // Pending signed-upload objects retain their worst-case reservation until
      // the Stage 15 janitor removes them after capability expiry.
      await tx
        .update(evidenceUploads)
        .set({
          reservedBytes: value.upload.holdUntil
            ? mediaCap(value.upload.kind)
            : 0,
        })
        .where(
          and(
            eq(evidenceUploads.businessId, claim.businessId),
            eq(evidenceUploads.id, claim.id),
          ),
        );
      await this.event(tx, value.lifecycle, 'PURGED', finished);
      return 'purged';
    });
  }
  async runBatch(
    options: { apply?: boolean; limit?: number; businessId?: string } = {},
  ) {
    const apply = options.apply === true;
    if (apply && !retentionDeletionEnabled())
      throw new ForbiddenException({
        code: 'EVIDENCE_RETENTION_DISABLED',
        message:
          'Media deletion requires explicit enablement on the development project',
      });
    const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 20)));
    if (!Number.isFinite(limit))
      throw new Error('Invalid retention batch limit');
    const result = {
      mode: apply ? 'APPLY' : 'DRY_RUN',
      eligible: 0,
      purged: 0,
      retryRequired: 0,
      skipped: 0,
      failed: 0,
    };
    // A bounded indexed candidate page. Every destructive action rechecks its
    // current settings, tenant state, hold and lease under the tenant lock.
    const candidates = await this.database.db
      .select({
        id: evidenceLifecycles.evidenceId,
        businessId: evidenceLifecycles.businessId,
      })
      .from(evidenceLifecycles)
      .innerJoin(businesses, eq(businesses.id, evidenceLifecycles.businessId))
      .innerJoin(
        rentals,
        and(
          eq(rentals.id, evidenceLifecycles.rentalId),
          eq(rentals.businessId, evidenceLifecycles.businessId),
        ),
      )
      .leftJoin(
        evidenceRetentionSettings,
        eq(evidenceRetentionSettings.businessId, evidenceLifecycles.businessId),
      )
      .leftJoin(
        evidenceRentalHolds,
        and(
          eq(evidenceRentalHolds.businessId, evidenceLifecycles.businessId),
          eq(evidenceRentalHolds.rentalId, evidenceLifecycles.rentalId),
        ),
      )
      .where(
        and(
          eq(businesses.status, 'ACTIVE'),
          eq(evidenceLifecycles.important, false),
          sql`${rentals.status} = 'COMPLETED' and ${rentals.returnedAt} is not null and
          ${rentals.returnedAt} + (coalesce(${evidenceRetentionSettings.retentionDays},30) * interval '1 day') <= clock_timestamp()`,
          sql`coalesce(${evidenceRentalHolds.active},false) = false and coalesce(${evidenceRentalHolds.unresolvedDispute},false) = false`,
          sql`(${evidenceLifecycles.status} in ('ACTIVE','PURGE_ELIGIBLE') or
          (${evidenceLifecycles.status} = 'PURGING' and ${evidenceLifecycles.leaseUntil} <= clock_timestamp()) or
          (${evidenceLifecycles.status} = 'RETRY_REQUIRED' and (${evidenceLifecycles.nextRetryAt} is null or ${evidenceLifecycles.nextRetryAt} <= clock_timestamp())))`,
          options.businessId
            ? eq(evidenceLifecycles.businessId, options.businessId)
            : undefined,
        ),
      )
      .orderBy(asc(rentals.returnedAt), asc(evidenceLifecycles.evidenceId))
      .limit(limit);
    for (const candidate of candidates) {
      if (!apply) {
        const eligible = await this.database.db.transaction(async (tx) => {
          const business = await this.lock(tx, candidate.businessId);
          const value = await this.record(
            tx,
            candidate.businessId,
            candidate.id,
          );
          return (
            business?.status === 'ACTIVE' &&
            !!value &&
            (await this.eligible(tx, value, await clock(tx)))
          );
        });
        if (eligible) result.eligible++;
        continue;
      }
      try {
        const claim = await this.claim(candidate.businessId, candidate.id);
        if (!claim) {
          result.skipped++;
          continue;
        }
        result.eligible++;
        const outcome = await this.purge(claim);
        if (outcome === 'purged') result.purged++;
        else if (outcome === 'retry') result.retryRequired++;
        else result.skipped++;
      } catch {
        result.failed++;
      } // No provider details or object paths in job output.
    }
    return result;
  }
}
