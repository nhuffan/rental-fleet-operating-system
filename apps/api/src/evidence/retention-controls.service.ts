import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor, type Permission } from '../auth/permissions.js';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  memberships,
  profiles,
  rentals,
  evidenceAttachments,
  evidenceUploads,
  evidenceRetentionSettings,
  evidenceRentalHolds,
  evidenceLifecycles,
  evidenceRetentionEvents,
} from '../database/schema.js';
import { evidenceLimits } from './config.js';
import { retentionDeletionEnabled } from './retention-policy.js';
import type {
  EvidenceImportantUpdate,
  EvidenceRentalHoldUpdate,
  EvidenceRetentionSettingsUpdate,
} from './retention.dto.js';
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
const missing = () =>
  new NotFoundException({
    code: 'EVIDENCE_NOT_FOUND',
    message: 'Evidence resource not found',
  });
const invalid = () =>
  new BadRequestException({
    code: 'EVIDENCE_RETENTION_VALIDATION',
    message:
      'Use a supported policy and a nonblank reason; unresolved disputes cannot be released',
  });
const locked = () =>
  new ConflictException({
    code: 'EVIDENCE_RETENTION_LOCKED',
    message:
      'Media deletion is in progress or requires reconciliation. Retry after maintenance completes',
  });
function reason(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000)
    throw invalid();
  return value.trim();
}
const unsafe = ['PURGING', 'RETRY_REQUIRED'] as const;
@Injectable()
export class EvidenceRetentionControls {
  constructor(@Inject(Database) private readonly database: Database) {}
  private async locked<T>(
    c: TenantContext,
    permission: Permission,
    operation: (tx: Tx, now: Date) => Promise<T>,
  ) {
    return this.database.db.transaction(async (tx) => {
      const [business] = await tx
        .select()
        .from(businesses)
        .where(eq(businesses.id, c.businessId))
        .for('update');
      const [member] = await tx
        .select({ role: memberships.roleKey })
        .from(memberships)
        .innerJoin(profiles, eq(profiles.userId, memberships.userId))
        .where(
          and(
            eq(memberships.id, c.membershipId),
            eq(memberships.businessId, c.businessId),
            eq(memberships.userId, c.userId),
            eq(memberships.status, 'ACTIVE'),
            eq(profiles.status, 'ACTIVE'),
          ),
        );
      if (!member || business?.status !== 'ACTIVE') throw denied();
      if (!permissionsFor(member.role).includes(permission))
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: 'Permission denied',
        });
      const now = new Date(
        (
          await tx.execute<{ now: string }>(
            sql`select clock_timestamp()::text now`,
          )
        ).rows[0].now,
      );
      return operation(tx, now);
    });
  }
  private async rental(tx: Tx, c: TenantContext, id: string) {
    const [rental] = await tx
      .select({ id: rentals.id })
      .from(rentals)
      .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
    if (!rental) throw missing();
    return rental;
  }
  private async currentDays(tx: Tx, c: TenantContext) {
    const [settings] = await tx
      .select({ retentionDays: evidenceRetentionSettings.retentionDays })
      .from(evidenceRetentionSettings)
      .where(eq(evidenceRetentionSettings.businessId, c.businessId));
    return settings?.retentionDays ?? 30;
  }
  private async event(
    tx: Tx,
    c: TenantContext,
    now: Date,
    data: {
      action:
        | 'POLICY_UPDATED'
        | 'IMPORTANT_SET'
        | 'IMPORTANT_RELEASED'
        | 'LEGAL_HOLD_SET'
        | 'LEGAL_HOLD_RELEASED';
      rentalId?: string;
      evidenceId?: string;
      reason?: string;
    },
    requestId: string,
    fields: string[],
  ) {
    await tx.insert(evidenceRetentionEvents).values({
      businessId: c.businessId,
      rentalId: data.rentalId ?? null,
      evidenceId: data.evidenceId ?? null,
      actorId: c.userId,
      action: data.action,
      reason: data.reason ?? null,
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      businessId: c.businessId,
      actorUserId: c.userId,
      entityType: 'inspection_evidence_retention',
      entityId: data.evidenceId ?? data.rentalId ?? c.businessId,
      action: 'evidence.retention.' + data.action.toLowerCase(),
      metadata: { requestId, fields },
      createdAt: now,
    });
  }
  async settings(c: TenantContext) {
    return this.locked(c, 'settings.read', async (tx) => ({
      retentionDays: await this.currentDays(tx, c),
      deletionEnabled: retentionDeletionEnabled(),
    }));
  }
  async updateSettings(
    c: TenantContext,
    body: EvidenceRetentionSettingsUpdate,
    requestId: string,
  ) {
    if (!body || ![30, 90].includes(body.retentionDays)) throw invalid();
    return this.locked(c, 'settings.update', async (tx, now) => {
      const [busy] = await tx
        .select({ id: evidenceLifecycles.evidenceId })
        .from(evidenceLifecycles)
        .where(
          and(
            eq(evidenceLifecycles.businessId, c.businessId),
            inArray(evidenceLifecycles.status, [...unsafe]),
          ),
        )
        .limit(1);
      if (busy) throw locked();
      await tx
        .insert(evidenceRetentionSettings)
        .values({
          businessId: c.businessId,
          retentionDays: body.retentionDays,
          updatedAt: now,
          updatedBy: c.userId,
        })
        .onConflictDoUpdate({
          target: evidenceRetentionSettings.businessId,
          set: {
            retentionDays: body.retentionDays,
            updatedAt: now,
            updatedBy: c.userId,
          },
        });
      await this.event(tx, c, now, { action: 'POLICY_UPDATED' }, requestId, [
        'retentionDays',
      ]);
      return {
        retentionDays: body.retentionDays,
        deletionEnabled: retentionDeletionEnabled(),
      };
    });
  }
  async hold(c: TenantContext, rentalId: string) {
    return this.locked(c, 'rental.read', async (tx) => {
      await this.rental(tx, c, rentalId);
      const [hold] = await tx
        .select()
        .from(evidenceRentalHolds)
        .where(
          and(
            eq(evidenceRentalHolds.businessId, c.businessId),
            eq(evidenceRentalHolds.rentalId, rentalId),
          ),
        );
      return {
        rentalId,
        active: hold?.active ?? false,
        unresolvedDispute: hold?.unresolvedDispute ?? false,
        reason: hold?.reason ?? '',
        actorId: hold?.actorId ?? null,
        changedAt: hold?.changedAt ?? null,
      };
    });
  }
  async updateHold(
    c: TenantContext,
    rentalId: string,
    body: EvidenceRentalHoldUpdate,
    requestId: string,
  ) {
    if (
      !body ||
      typeof body.active !== 'boolean' ||
      typeof body.unresolvedDispute !== 'boolean' ||
      (!body.active && body.unresolvedDispute)
    )
      throw invalid();
    const note = reason(body.reason);
    return this.locked(c, 'rental.manage', async (tx, now) => {
      await this.rental(tx, c, rentalId);
      const [busy] = await tx
        .select({ id: evidenceLifecycles.evidenceId })
        .from(evidenceLifecycles)
        .where(
          and(
            eq(evidenceLifecycles.businessId, c.businessId),
            eq(evidenceLifecycles.rentalId, rentalId),
            inArray(evidenceLifecycles.status, [...unsafe]),
          ),
        )
        .limit(1);
      if (busy) throw locked();
      await tx
        .insert(evidenceRentalHolds)
        .values({
          businessId: c.businessId,
          rentalId,
          active: body.active,
          unresolvedDispute: body.unresolvedDispute,
          reason: note,
          actorId: c.userId,
          changedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            evidenceRentalHolds.businessId,
            evidenceRentalHolds.rentalId,
          ],
          set: {
            active: body.active,
            unresolvedDispute: body.unresolvedDispute,
            reason: note,
            actorId: c.userId,
            changedAt: now,
          },
        });
      await this.event(
        tx,
        c,
        now,
        {
          action: body.active ? 'LEGAL_HOLD_SET' : 'LEGAL_HOLD_RELEASED',
          rentalId,
          reason: note,
        },
        requestId,
        ['active', 'unresolvedDispute', 'reason'],
      );
      return {
        rentalId,
        active: body.active,
        unresolvedDispute: body.unresolvedDispute,
        reason: note,
        actorId: c.userId,
        changedAt: now,
      };
    });
  }
  async updateImportant(
    c: TenantContext,
    rentalId: string,
    evidenceId: string,
    body: EvidenceImportantUpdate,
    requestId: string,
  ) {
    if (!body || typeof body.important !== 'boolean') throw invalid();
    const note = reason(body.reason);
    return this.locked(c, 'rental.manage', async (tx, now) => {
      await this.rental(tx, c, rentalId);
      const [record] = await tx
        .select({ lifecycle: evidenceLifecycles })
        .from(evidenceLifecycles)
        .innerJoin(
          evidenceAttachments,
          and(
            eq(evidenceAttachments.businessId, evidenceLifecycles.businessId),
            eq(evidenceAttachments.id, evidenceLifecycles.evidenceId),
            eq(evidenceAttachments.rentalId, evidenceLifecycles.rentalId),
          ),
        )
        .where(
          and(
            eq(evidenceLifecycles.businessId, c.businessId),
            eq(evidenceLifecycles.rentalId, rentalId),
            eq(evidenceLifecycles.evidenceId, evidenceId),
          ),
        );
      if (!record) throw missing();
      if (
        record.lifecycle.status === 'PURGED' ||
        unsafe.includes(record.lifecycle.status as (typeof unsafe)[number])
      )
        throw locked();
      await tx
        .update(evidenceLifecycles)
        .set({
          important: body.important,
          importantReason: note,
          importantBy: c.userId,
          importantAt: now,
          updatedAt: now,
          ...(body.important ? { status: 'ACTIVE' as const } : {}),
        })
        .where(
          and(
            eq(evidenceLifecycles.businessId, c.businessId),
            eq(evidenceLifecycles.evidenceId, evidenceId),
            eq(evidenceLifecycles.rentalId, rentalId),
          ),
        );
      await this.event(
        tx,
        c,
        now,
        {
          action: body.important ? 'IMPORTANT_SET' : 'IMPORTANT_RELEASED',
          rentalId,
          evidenceId,
          reason: note,
        },
        requestId,
        ['important', 'reason'],
      );
      return {
        evidenceId,
        important: body.important,
        reason: note,
        actorId: c.userId,
        changedAt: now,
      };
    });
  }
  async usage(c: TenantContext) {
    return this.locked(c, 'settings.read', async (tx, now) => {
      const bucket = sql<string>`case when ${evidenceLifecycles.status}='PURGED' then 'purged'
        when ${evidenceLifecycles.important} or ${evidenceRentalHolds.active} or ${evidenceRentalHolds.unresolvedDispute} then 'held'
        when ${rentals.status}='COMPLETED' and ${rentals.returnedAt} is not null and isfinite(${rentals.returnedAt}) and ${rentals.returnedAt}<=${now} then 'retained' else 'active' end`;
      const groups = await tx
        .select({
          bucket,
          count: sql<string>`count(*)::text`,
          bytes: sql<string>`coalesce(sum(${evidenceAttachments.bytes}),0)::text`,
        })
        .from(evidenceAttachments)
        .innerJoin(
          rentals,
          and(
            eq(rentals.businessId, evidenceAttachments.businessId),
            eq(rentals.id, evidenceAttachments.rentalId),
          ),
        )
        .leftJoin(
          evidenceLifecycles,
          and(
            eq(evidenceLifecycles.businessId, evidenceAttachments.businessId),
            eq(evidenceLifecycles.evidenceId, evidenceAttachments.id),
            eq(evidenceLifecycles.rentalId, evidenceAttachments.rentalId),
          ),
        )
        .leftJoin(
          evidenceRentalHolds,
          and(
            eq(evidenceRentalHolds.businessId, evidenceAttachments.businessId),
            eq(evidenceRentalHolds.rentalId, evidenceAttachments.rentalId),
          ),
        )
        .where(eq(evidenceAttachments.businessId, c.businessId))
        // Group by the first selected expression: repeating its bound clock parameter
        // produces distinct PostgreSQL parameters and is not an identical grouping expression.
        .groupBy(sql`1`);
      const [uploads] = await tx
        .select({
          reserved: sql<string>`coalesce(sum(${evidenceUploads.reservedBytes}),0)::text`,
          count: sql<string>`count(*) filter(where ${evidenceUploads.status}<>'ATTACHED' and ${evidenceUploads.reservedBytes}>0)::text`,
          bytes: sql<string>`coalesce(sum(${evidenceUploads.reservedBytes}) filter(where ${evidenceUploads.status}<>'ATTACHED'),0)::text`,
        })
        .from(evidenceUploads)
        .where(eq(evidenceUploads.businessId, c.businessId));
      const result = {
        retentionDays: await this.currentDays(tx, c),
        deletionEnabled: retentionDeletionEnabled(),
        limits: { maxTenantBytes: evidenceLimits().maxTenantBytes },
        totalReservedBytes: Number(uploads.reserved),
        active: { count: 0, bytes: 0 },
        retained: { count: 0, bytes: 0 },
        held: { count: 0, bytes: 0 },
        purged: { count: 0, bytes: 0 },
        pending: { count: Number(uploads.count), bytes: Number(uploads.bytes) },
      };
      for (const row of groups)
        if (['active', 'retained', 'held', 'purged'].includes(row.bucket))
          result[row.bucket as 'active' | 'retained' | 'held' | 'purged'] = {
            count: Number(row.count),
            bytes: Number(row.bytes),
          };
      return result;
    });
  }
}
