import { retentionView } from './retention-policy.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { isUUID } from 'class-validator';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  memberships,
  profiles,
  rentals,
  rentalInspections,
  evidenceUploads,
  evidenceAttachments,
  evidenceLifecycles,
  evidenceRentalHolds,
  evidenceRetentionSettings,
} from '../database/schema.js';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor, type Permission } from '../auth/permissions.js';
import {
  type EvidenceUploadCreate,
  EVIDENCE_CATEGORIES,
  EVIDENCE_KINDS,
  EVIDENCE_MIMES,
  EVIDENCE_TYPES,
} from './dto.js';
import {
  evidenceLimits,
  IMAGE_BUCKET,
  VIDEO_BUCKET,
  mediaCap,
  READ_TTL_SECONDS,
  UPLOAD_HOLD_MS,
  VERIFY_LEASE_MS,
  WORKFLOW_TTL_MS,
} from './config.js';
import { EvidenceStorage } from './storage.js';
import { MediaInspector } from './media-inspector.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Upload = typeof evidenceUploads.$inferSelect;
type Attachment = typeof evidenceAttachments.$inferSelect;
type Milestone = 'HANDOVER' | 'RETURN';
const missing = () =>
  new NotFoundException({
    code: 'EVIDENCE_NOT_FOUND',
    message: 'Evidence resource not found',
  });
const invalid = (message: string, code = 'EVIDENCE_INVALID_UPLOAD') =>
  new BadRequestException({ code, message });
const conflict = (message: string, code = 'EVIDENCE_UPLOAD_LOCKED') =>
  new ConflictException({ code, message });
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
const ext = (mime: string) => extensions[mime];
const nowIn = async (tx: Tx) =>
  new Date(
    (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text now`))
      .rows[0].now,
  );
const visibleUpload = (row: Upload) => ({
  id: row.id,
  status: row.status,
  kind: row.kind,
  category: row.category,
  mimeType: row.mimeType ?? row.declaredMime,
  bytes: row.bytes ?? row.declaredBytes,
  durationSeconds: row.durationSeconds,
  width: row.width,
  height: row.height,
  expiresAt: row.expiresAt,
});
const visibleAttachment = (row: Attachment) => ({
  id: row.id,
  inspectionId: row.inspectionId,
  rentalId: row.rentalId,
  vehicleId: row.vehicleId,
  type: row.type,
  kind: row.kind,
  category: row.category,
  uploadedBy: row.uploadedBy,
  mimeType: row.mimeType,
  bytes: row.bytes,
  width: row.width,
  height: row.height,
  durationSeconds: row.durationSeconds,
  createdAt: row.createdAt,
});
function quota(message: string): never {
  throw conflict(message, 'EVIDENCE_QUOTA_EXCEEDED');
}
function assertIds(ids: unknown): asserts ids is string[] {
  if (
    !Array.isArray(ids) ||
    ids.length > 9 ||
    ids.some((id) => typeof id !== 'string' || !isUUID(id)) ||
    new Set(ids).size !== ids.length
  )
    throw invalid('Provide up to nine unique verified upload IDs');
}
/** Called only inside the existing locked rental lifecycle transaction. */
export async function attachEvidence(
  tx: Tx,
  c: TenantContext,
  rental: { id: string; vehicleId: string },
  inspectionId: string,
  type: Milestone,
  uploadIds: unknown,
  now: Date,
) {
  const ids = uploadIds ?? [];
  assertIds(ids);
  if (!ids.length) return;
  const rows = await tx
    .select()
    .from(evidenceUploads)
    .where(
      and(
        eq(evidenceUploads.businessId, c.businessId),
        eq(evidenceUploads.rentalId, rental.id),
        inArray(evidenceUploads.id, ids),
      ),
    );
  if (
    rows.length !== ids.length ||
    rows.some(
      (row) =>
        row.type !== type ||
        row.vehicleId !== rental.vehicleId ||
        row.uploadedBy !== c.userId ||
        row.status !== 'VERIFIED' ||
        row.expiresAt <= now ||
        !row.mimeType ||
        !row.bytes ||
        !row.width ||
        !row.height,
    )
  )
    throw invalid(
      'Every file must be verified, unexpired and owned by this inspection workflow',
    );
  const limits = evidenceLimits();
  if (
    rows.filter((x) => x.kind === 'IMAGE').length > limits.maxImages ||
    rows.filter((x) => x.kind === 'VIDEO').length > limits.maxVideos ||
    rows.reduce((n, row) => n + Number(row.bytes), 0) >
      limits.maxInspectionBytes
  )
    quota('Inspection evidence exceeds its configured budget');
  await tx.insert(evidenceAttachments).values(
    rows.map((row) => ({
      id: row.id,
      businessId: c.businessId,
      rentalId: rental.id,
      vehicleId: rental.vehicleId,
      inspectionId,
      type,
      kind: row.kind,
      category: row.category,
      uploadedBy: row.uploadedBy,
      bucket: row.bucket,
      objectKey: row.objectKey,
      mimeType: row.mimeType!,
      bytes: row.bytes!,
      width: row.width!,
      height: row.height!,
      durationSeconds: row.durationSeconds,
      createdAt: now,
    })),
  );
  await tx
    .update(evidenceUploads)
    .set({ status: 'ATTACHED', leaseUntil: null })
    .where(
      and(
        eq(evidenceUploads.businessId, c.businessId),
        inArray(evidenceUploads.id, ids),
      ),
    );
}
@Injectable()
export class EvidenceService {
  private readonly storage = new EvidenceStorage();
  private readonly inspector = new MediaInspector();
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
      return operation(tx, await nowIn(tx));
    });
  }
  private async rental(tx: Tx, c: TenantContext, id: string) {
    const [rental] = await tx
      .select()
      .from(rentals)
      .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
    if (!rental) throw missing();
    return rental;
  }
  private async openWorkflow(
    tx: Tx,
    c: TenantContext,
    rentalId: string,
    type: Milestone,
  ) {
    const rental = await this.rental(tx, c, rentalId);
    if (rental.status !== (type === 'HANDOVER' ? 'RESERVED' : 'ACTIVE'))
      throw conflict(
        'This inspection milestone is not open',
        'INVALID_RENTAL_STATE',
      );
    const [existing] = await tx
      .select({ id: rentalInspections.id })
      .from(rentalInspections)
      .where(
        and(
          eq(rentalInspections.businessId, c.businessId),
          eq(rentalInspections.rentalId, rentalId),
          eq(rentalInspections.type, type),
        ),
      )
      .limit(1);
    if (existing)
      throw conflict(
        'This inspection is already immutable',
        'INVALID_RENTAL_STATE',
      );
    return rental;
  }
  private async upload(tx: Tx, c: TenantContext, rentalId: string, id: string) {
    await this.rental(tx, c, rentalId);
    const [row] = await tx
      .select()
      .from(evidenceUploads)
      .where(
        and(
          eq(evidenceUploads.businessId, c.businessId),
          eq(evidenceUploads.rentalId, rentalId),
          eq(evidenceUploads.id, id),
          eq(evidenceUploads.uploadedBy, c.userId),
        ),
      );
    if (!row) throw missing();
    return row;
  }
  private async audit(
    tx: Tx,
    c: TenantContext,
    id: string,
    action: string,
    requestId: string,
    fields: string[],
  ) {
    await tx.insert(auditLogs).values({
      businessId: c.businessId,
      actorUserId: c.userId,
      entityType: 'inspection_evidence',
      entityId: id,
      action,
      metadata: { requestId, fields },
    });
  }
  async begin(
    c: TenantContext,
    rentalId: string,
    body: EvidenceUploadCreate,
    requestId: string,
  ) {
    this.storage.assertConfigured();
    const limits = evidenceLimits();
    if (
      !body ||
      !isUUID(body.idempotencyKey) ||
      !EVIDENCE_TYPES.includes(body.type) ||
      !EVIDENCE_KINDS.includes(body.kind) ||
      !EVIDENCE_CATEGORIES.includes(body.category) ||
      !EVIDENCE_MIMES.includes(body.mimeType) ||
      !Number.isSafeInteger(body.bytes) ||
      body.bytes < 1 ||
      body.bytes > mediaCap(body.kind) ||
      body.mimeType.startsWith('image/') !== (body.kind === 'IMAGE')
    )
      throw invalid('Provide a supported, size-bounded image or video');
    const row = await this.locked(c, 'rental.manage', async (tx, now) => {
      const rental = await this.openWorkflow(tx, c, rentalId, body.type);
      const [existing] = await tx
        .select()
        .from(evidenceUploads)
        .where(
          and(
            eq(evidenceUploads.businessId, c.businessId),
            eq(evidenceUploads.uploadedBy, c.userId),
            eq(evidenceUploads.idempotencyKey, body.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) {
        if (
          existing.rentalId !== rentalId ||
          existing.type !== body.type ||
          existing.kind !== body.kind ||
          existing.category !== body.category ||
          existing.declaredMime !== body.mimeType ||
          existing.declaredBytes !== body.bytes
        )
          throw conflict(
            'Idempotency key belongs to a different upload',
            'EVIDENCE_IDEMPOTENCY_CONFLICT',
          );
        if (
          existing.expiresAt <= now ||
          !['PENDING', 'VERIFYING', 'VERIFIED'].includes(existing.status)
        )
          throw conflict(
            'Upload is no longer available',
            'EVIDENCE_UPLOAD_EXPIRED',
          );
        const [renewed] = await tx
          .update(evidenceUploads)
          .set({ holdUntil: new Date(now.getTime() + UPLOAD_HOLD_MS) })
          .where(eq(evidenceUploads.id, existing.id))
          .returning();
        return renewed;
      }
      const [totals] = await tx
        .select({
          held: sql<string>`coalesce(sum(${evidenceUploads.reservedBytes}),0)::text`,
          active: sql<number>`count(*) filter (where ${evidenceUploads.status} in ('PENDING','VERIFYING') and ${evidenceUploads.expiresAt} > ${now})::int`,
        })
        .from(evidenceUploads)
        .where(eq(evidenceUploads.businessId, c.businessId));
      const reservation = 2 * mediaCap(body.kind);
      if (Number(totals.held) + reservation > limits.maxTenantBytes)
        quota(
          'Tenant evidence storage budget is full; expired upload reservations await cleanup',
        );
      if (totals.active >= limits.maxConcurrentUploads)
        quota('Too many concurrent evidence uploads');
      const milestone = await tx
        .select()
        .from(evidenceUploads)
        .where(
          and(
            eq(evidenceUploads.businessId, c.businessId),
            eq(evidenceUploads.rentalId, rentalId),
            eq(evidenceUploads.type, body.type),
            or(
              eq(evidenceUploads.status, 'ATTACHED'),
              and(
                inArray(evidenceUploads.status, [
                  'PENDING',
                  'VERIFYING',
                  'VERIFIED',
                ]),
                gt(evidenceUploads.expiresAt, now),
              ),
            ),
          ),
        );
      if (
        milestone.filter((row) => row.kind === body.kind).length >=
        (body.kind === 'IMAGE' ? limits.maxImages : limits.maxVideos)
      )
        quota('This inspection has reached its file-count limit');
      if (
        milestone.reduce(
          (n, row) => n + Number(row.bytes ?? row.declaredBytes),
          0,
        ) +
          body.bytes >
        limits.maxInspectionBytes
      )
        quota('This inspection has reached its byte limit');
      const id = randomUUID();
      const prefix = `b/${c.businessId}/rentals/${rentalId}/${body.type}`;
      const key = `${id}.${ext(body.mimeType)}`;
      const [created] = await tx
        .insert(evidenceUploads)
        .values({
          id,
          businessId: c.businessId,
          rentalId,
          vehicleId: rental.vehicleId,
          type: body.type,
          kind: body.kind,
          category: body.category,
          uploadedBy: c.userId,
          idempotencyKey: body.idempotencyKey,
          status: 'PENDING',
          bucket: body.kind === 'IMAGE' ? IMAGE_BUCKET : VIDEO_BUCKET,
          pendingKey: `${prefix}/pending/${key}`,
          objectKey: `${prefix}/evidence/${key}`,
          declaredMime: body.mimeType,
          declaredBytes: body.bytes,
          reservedBytes: reservation,
          expiresAt: new Date(now.getTime() + WORKFLOW_TTL_MS),
          holdUntil: new Date(now.getTime() + UPLOAD_HOLD_MS),
          createdAt: now,
        })
        .returning();
      await this.audit(tx, c, id, 'inspection.evidence.stage', requestId, [
        'kind',
        'category',
      ]);
      return created;
    });
    const authorization = await this.storage.authorize(
      row.bucket,
      row.pendingKey,
    );
    return {
      ...visibleUpload(row),
      ...authorization,
      bucket: row.bucket,
      objectKey: row.pendingKey,
      limits,
    };
  }
  async verify(
    c: TenantContext,
    rentalId: string,
    id: string,
    requestId: string,
  ) {
    const claim = await this.locked(c, 'rental.manage', async (tx, now) => {
      const row = await this.upload(tx, c, rentalId, id);
      if (row.status === 'ATTACHED') return { row, done: true };
      if (!['PENDING', 'VERIFYING', 'VERIFIED'].includes(row.status))
        throw conflict('Upload is not verifiable');
      await this.openWorkflow(tx, c, rentalId, row.type);
      if (row.expiresAt <= now)
        throw conflict(
          'Upload verification window expired',
          'EVIDENCE_UPLOAD_EXPIRED',
        );
      if (row.status === 'VERIFIED') return { row, done: true };
      if (row.status === 'VERIFYING' && row.leaseUntil && row.leaseUntil > now)
        throw conflict('Verification is already running', 'EVIDENCE_VERIFYING');
      const [updated] = await tx
        .update(evidenceUploads)
        .set({
          status: 'VERIFYING',
          leaseUntil: new Date(now.getTime() + VERIFY_LEASE_MS),
        })
        .where(eq(evidenceUploads.id, id))
        .returning();
      return { row: updated, done: false };
    });
    if (claim.done) return visibleUpload(claim.row);
    try {
      const bytes = await this.storage.download(
        claim.row.bucket,
        claim.row.pendingKey,
        claim.row.kind,
      );
      const actual = await this.inspector.inspect(bytes, claim.row.kind);
      if (
        actual.mimeType !== claim.row.declaredMime ||
        actual.bytes !== claim.row.declaredBytes ||
        actual.bytes > mediaCap(claim.row.kind)
      )
        throw invalid(
          'Actual uploaded media does not match its reservation',
          'EVIDENCE_INVALID_FILE',
        );
      await this.storage.copy(
        claim.row.bucket,
        claim.row.pendingKey,
        claim.row.objectKey,
      );
      return await this.locked(c, 'rental.manage', async (tx, now) => {
        const row = await this.upload(tx, c, rentalId, id);
        await this.openWorkflow(tx, c, rentalId, row.type);
        if (
          row.status !== 'VERIFYING' ||
          row.leaseUntil?.getTime() !== claim.row.leaseUntil?.getTime() ||
          row.expiresAt <= now
        )
          throw conflict(
            'Upload was cancelled or expired',
            'EVIDENCE_UPLOAD_EXPIRED',
          );
        const [verified] = await tx
          .update(evidenceUploads)
          .set({
            status: 'VERIFIED',
            mimeType: actual.mimeType,
            bytes: actual.bytes,
            width: actual.width,
            height: actual.height,
            durationSeconds: actual.durationSeconds,
            verifiedAt: now,
            leaseUntil: null,
          })
          .where(eq(evidenceUploads.id, id))
          .returning();
        await this.audit(tx, c, id, 'inspection.evidence.verify', requestId, [
          'status',
        ]);
        return visibleUpload(verified);
      });
    } catch (error) {
      await this.locked(c, 'rental.manage', async (tx) => {
        const row = await this.upload(tx, c, rentalId, id);
        // A slow original verifier must never reset a replacement verifier's
        // lease, even when its own decoder/storage request eventually fails.
        if (
          row.status === 'VERIFYING' &&
          row.leaseUntil?.getTime() === claim.row.leaseUntil?.getTime()
        )
          await tx
            .update(evidenceUploads)
            .set({
              status:
                error instanceof BadRequestException ? 'REJECTED' : 'PENDING',
              leaseUntil: null,
            })
            .where(eq(evidenceUploads.id, id));
      }).catch(() => undefined);
      throw error;
    }
  }
  async cancel(
    c: TenantContext,
    rentalId: string,
    id: string,
    requestId: string,
  ) {
    return this.locked(c, 'rental.manage', async (tx) => {
      const row = await this.upload(tx, c, rentalId, id);
      if (row.status === 'ATTACHED')
        throw conflict('Attached evidence is immutable');
      if (['CANCELLED', 'REJECTED', 'PURGED'].includes(row.status))
        return visibleUpload(row);
      const [cancelled] = await tx
        .update(evidenceUploads)
        .set({ status: 'CANCELLED', leaseUntil: null })
        .where(eq(evidenceUploads.id, id))
        .returning();
      // Keep capability-target objects and quota until holdUntil to prevent
      // replaying a still-valid signed upload into a newly freed object path.
      await this.audit(tx, c, id, 'inspection.evidence.cancel', requestId, [
        'status',
      ]);
      return visibleUpload(cancelled);
    });
  }
  private async retentionContext(tx: Tx, c: TenantContext, rentalId: string) {
    const rental = await this.rental(tx, c, rentalId);
    const [setting] = await tx
      .select()
      .from(evidenceRetentionSettings)
      .where(eq(evidenceRetentionSettings.businessId, c.businessId));
    const [hold] = await tx
      .select()
      .from(evidenceRentalHolds)
      .where(
        and(
          eq(evidenceRentalHolds.businessId, c.businessId),
          eq(evidenceRentalHolds.rentalId, rentalId),
        ),
      );
    return { rental, days: setting?.retentionDays ?? 30, hold };
  }
  async list(c: TenantContext, rentalId: string) {
    return this.locked(c, 'rental.read', async (tx, now) => {
      const { rental, days, hold } = await this.retentionContext(
        tx,
        c,
        rentalId,
      );
      const rows = await tx
        .select({
          attachment: evidenceAttachments,
          lifecycle: evidenceLifecycles,
        })
        .from(evidenceAttachments)
        .leftJoin(
          evidenceLifecycles,
          and(
            eq(evidenceLifecycles.evidenceId, evidenceAttachments.id),
            eq(evidenceLifecycles.businessId, c.businessId),
          ),
        )
        .where(
          and(
            eq(evidenceAttachments.businessId, c.businessId),
            eq(evidenceAttachments.rentalId, rentalId),
          ),
        )
        .orderBy(
          asc(evidenceAttachments.createdAt),
          asc(evidenceAttachments.id),
        )
        .limit(18);
      return {
        rentalId,
        data: rows.map(({ attachment, lifecycle }) => ({
          ...visibleAttachment(attachment),
          ...retentionView(rental, days, lifecycle, hold, now),
        })),
      };
    });
  }
  async signedRead(
    c: TenantContext,
    rentalId: string,
    id: string,
    download = false,
  ) {
    return this.locked(c, 'rental.read', async (tx, now) => {
      const { rental, days, hold } = await this.retentionContext(
        tx,
        c,
        rentalId,
      );
      const [row] = await tx
        .select({
          attachment: evidenceAttachments,
          lifecycle: evidenceLifecycles,
        })
        .from(evidenceAttachments)
        .leftJoin(
          evidenceLifecycles,
          and(
            eq(evidenceLifecycles.evidenceId, evidenceAttachments.id),
            eq(evidenceLifecycles.businessId, c.businessId),
          ),
        )
        .where(
          and(
            eq(evidenceAttachments.businessId, c.businessId),
            eq(evidenceAttachments.rentalId, rentalId),
            eq(evidenceAttachments.id, id),
          ),
        );
      if (!row) throw missing();
      const view = retentionView(rental, days, row.lifecycle, hold, now);
      const seconds = view.retentionDeadline
        ? Math.min(
            READ_TTL_SECONDS,
            Math.floor((+view.retentionDeadline - +now) / 1000),
          )
        : READ_TTL_SECONDS;
      if (!view.canRead || seconds < 1)
        throw new GoneException({
          code: 'EVIDENCE_MEDIA_UNAVAILABLE',
          message: 'This media is expired, being removed or permanently purged',
        });
      return {
        url: await this.storage.signRead(
          row.attachment.bucket,
          row.attachment.objectKey,
          seconds,
          download
            ? `inspection-${row.attachment.type.toLowerCase()}-${row.attachment.id}.${ext(row.attachment.mimeType)}`
            : undefined,
        ),
        expiresAt: new Date(+now + seconds * 1000),
      };
    });
  }
  /** Trusted maintenance command only. No HTTP endpoint can purge immutable evidence. */
  async cleanupExpired(limit = 100) {
    const now = new Date();
    const candidates = await this.database.db
      .select({
        id: evidenceUploads.id,
        businessId: evidenceUploads.businessId,
      })
      .from(evidenceUploads)
      .where(
        and(
          isNotNull(evidenceUploads.holdUntil),
          lte(evidenceUploads.holdUntil, now),
        ),
      )
      .orderBy(asc(evidenceUploads.holdUntil), asc(evidenceUploads.id))
      .limit(Math.max(1, Math.min(100, limit)));
    let purged = 0,
      pendingRemoved = 0;
    for (const candidate of candidates)
      await this.database.db.transaction(async (tx) => {
        await tx
          .select({ id: businesses.id })
          .from(businesses)
          .where(eq(businesses.id, candidate.businessId))
          .for('update');
        const [row] = await tx
          .select()
          .from(evidenceUploads)
          .where(
            and(
              eq(evidenceUploads.id, candidate.id),
              eq(evidenceUploads.businessId, candidate.businessId),
            ),
          );
        const current = await nowIn(tx);
        if (
          !row?.holdUntil ||
          row.holdUntil > current ||
          (row.leaseUntil && row.leaseUntil > current)
        )
          return;
        const attached = row.status === 'ATTACHED';
        const [lifecycle] = attached
          ? await tx
              .select()
              .from(evidenceLifecycles)
              .where(
                and(
                  eq(evidenceLifecycles.businessId, row.businessId),
                  eq(evidenceLifecycles.evidenceId, row.id),
                ),
              )
          : [];
        const finalPurged = lifecycle?.status === 'PURGED';
        await this.storage.remove(
          row.bucket,
          attached ? [row.pendingKey] : [row.pendingKey, row.objectKey],
        );
        await tx
          .update(evidenceUploads)
          .set({
            status: attached ? 'ATTACHED' : 'PURGED',
            reservedBytes: attached && !finalPurged ? row.bytes! : 0,
            holdUntil: null,
            leaseUntil: null,
          })
          .where(eq(evidenceUploads.id, row.id));
        if (attached) pendingRemoved++;
        else purged++;
      });
    return { purged, pendingRemoved };
  }
}
