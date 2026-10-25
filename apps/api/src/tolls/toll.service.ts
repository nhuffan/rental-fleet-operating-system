import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, count, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { isUUID } from 'class-validator';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor, type Permission } from '../auth/permissions.js';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  memberships,
  profiles,
  rentals,
  vehicles,
  tollImportBatches,
  tollTransactions,
  tollReviewEvents,
  commercialMovements,
} from '../database/schema.js';
import { recordTollExpense } from '../commercial/commercial.service.js';
import { parseTollCsv, type TollNormalized, type TollCsvInput } from './csv.js';
import {
  TollQuery,
  type TollBulkRecord,
  type TollImportConfirm,
  type TollImportPreview,
  type TollRecord,
  type TollReview,
} from './dto.js';
import type { TollPreviewRow, TollSuggestion } from './responses.js';
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Toll = typeof tollTransactions.$inferSelect;
const invalid = (message: string, code = 'TOLL_INVALID_REQUEST') =>
  new BadRequestException({ code, message });
const conflict = (message: string, code = 'TOLL_CONFLICT') =>
  new ConflictException({ code, message });
const missing = () =>
  new NotFoundException({
    code: 'TOLL_NOT_FOUND',
    message: 'Toll resource not found',
  });
const emptySuggestion = (): TollSuggestion => ({
  vehicleId: null,
  vehiclePlate: null,
  rentalId: null,
  rentalCandidates: [],
  ambiguous: false,
});
const note = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000)
    throw invalid('A nonblank review reason up to 2000 characters is required');
  return value.trim();
};
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const transactionWhere = (c: TenantContext, id: string) =>
  and(
    eq(tollTransactions.businessId, c.businessId),
    eq(tollTransactions.id, id),
  );
@Injectable()
export class TollService {
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
      if (business.currency !== 'VND')
        throw conflict(
          'Toll expenses support VND businesses only',
          'COMMERCIAL_CURRENCY_UNSUPPORTED',
        );
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
  private async get(tx: Tx, c: TenantContext, id: string) {
    const [row] = await tx
      .select()
      .from(tollTransactions)
      .where(transactionWhere(c, id));
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
      entityType: 'toll_transaction',
      entityId: id,
      action,
      metadata: { requestId, fields },
    });
  }
  private async event(
    tx: Tx,
    c: TenantContext,
    row: Toll,
    action: 'IMPORTED' | 'MATCH_CONFIRMED' | 'IGNORED' | 'RECORDED',
    reason: string,
    now: Date,
  ) {
    await tx.insert(tollReviewEvents).values({
      businessId: c.businessId,
      tollTransactionId: row.id,
      vehicleId: row.vehicleId,
      rentalId: row.rentalId,
      status: row.status,
      version: row.version,
      action,
      actorId: c.userId,
      reason,
      createdAt: now,
    });
  }
  /** One bounded SQL roundtrip for a page/import, with indexed lateral matches. */
  private async suggestions(
    tx: Tx,
    c: TenantContext,
    rows: (TollNormalized | Toll)[],
    now: Date,
  ) {
    if (!rows.length) return [];
    const input = rows.map((row, index) => ({
      idx: index,
      plate: row.plate,
      occurred_at:
        row.occurredAt instanceof Date
          ? row.occurredAt.toISOString()
          : row.occurredAt,
      amount: row.amount,
      source: row.source,
      fingerprint: row.fingerprint,
      id: 'id' in row ? row.id : null,
      vehicle_id: 'vehicleId' in row ? row.vehicleId : null,
      movement_id: 'movementId' in row ? row.movementId : null,
    }));
    const result = await tx.execute<{
      idx: number;
      vehicle_id: string | null;
      vehicle_plate: string | null;
      rental_candidates: string[];
      duplicate_ids: string[];
      collision: boolean;
    }>(sql`
      with input as (select * from jsonb_to_recordset(${JSON.stringify(input)}::jsonb)
        as i(idx int,plate text,occurred_at timestamptz,amount numeric,source text,fingerprint text,id uuid,vehicle_id uuid,movement_id uuid))
      select i.idx,v.id vehicle_id,v.license_plate vehicle_plate,
        array(select r.id::text from public.rentals r where r.business_id=${c.businessId} and r.vehicle_id=v.id
          and r.status in ('ACTIVE','COMPLETED') and r.handed_over_at<=i.occurred_at
          and ((r.status='ACTIVE' and i.occurred_at<=${now}) or (r.status='COMPLETED' and i.occurred_at<r.returned_at))
          order by r.handed_over_at,r.id limit 3) rental_candidates,
        array(select m.id::text from public.commercial_movements m where m.business_id=${c.businessId}
          and m.vehicle_id=coalesce(i.vehicle_id,v.id) and m.kind='EXPENSE' and m.category='TOLL'
          and m.amount=i.amount and m.occurred_at>=i.occurred_at-interval '5 minutes' and m.occurred_at<=i.occurred_at+interval '5 minutes'
          and m.reversal_of is null and m.id<>coalesce(i.movement_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and not exists(select 1 from public.commercial_movements rev where rev.business_id=${c.businessId} and rev.reversal_of=m.id)
          order by m.occurred_at,m.id limit 5) duplicate_ids,
        exists(select 1 from public.toll_transactions t where t.business_id=${c.businessId} and t.source=i.source and t.fingerprint=i.fingerprint
          and t.id<>coalesce(i.id,'00000000-0000-0000-0000-000000000000'::uuid)) collision
      from input i left join public.vehicles v on v.business_id=${c.businessId} and v.license_plate=i.plate order by i.idx`);
    return result.rows.map((row) => ({
      suggestion: {
        vehicleId: row.vehicle_id,
        vehiclePlate: row.vehicle_plate,
        rentalId:
          row.rental_candidates.length === 1 && !row.collision
            ? row.rental_candidates[0]
            : null,
        rentalCandidates: row.rental_candidates,
        ambiguous: row.rental_candidates.length > 1 || row.collision,
      },
      possibleDuplicateMovementIds: row.duplicate_ids,
    }));
  }
  private async previewIn(
    tx: Tx,
    c: TenantContext,
    input: TollCsvInput,
    now: Date,
  ) {
    const parsed = parseTollCsv(input);
    const normalized = parsed.rows
      .filter((x) => x.normalized)
      .map((x) => x.normalized!);
    const suggestions = await this.suggestions(tx, c, normalized, now);
    const source = input.source.trim().toLowerCase();
    const existing = normalized.length
      ? await tx
          .select()
          .from(tollTransactions)
          .where(
            and(
              eq(tollTransactions.businessId, c.businessId),
              eq(tollTransactions.source, source),
              or(
                inArray(
                  tollTransactions.fingerprint,
                  normalized.map((x) => x.fingerprint),
                ),
                inArray(
                  tollTransactions.externalReference,
                  normalized
                    .filter((x) => x.externalReference)
                    .map((x) => x.externalReference),
                ),
              ),
            ),
          )
      : [];
    const seen = new Map<string, { fingerprint: string; rowNumber: number }>();
    let index = 0;
    const fingerprintCounts = new Map<string, number>();
    for (const row of normalized)
      fingerprintCounts.set(
        row.fingerprint,
        (fingerprintCounts.get(row.fingerprint) ?? 0) + 1,
      );
    const rows: TollPreviewRow[] = parsed.rows.map((row) => {
      const value = row.normalized;
      if (!value)
        return {
          ...row,
          status: 'INVALID',
          duplicateOf: null,
          suggestion: emptySuggestion(),
          possibleDuplicateMovementIds: [],
        };
      const matching = suggestions[index++];
      if ((fingerprintCounts.get(value.fingerprint) ?? 0) > 1)
        matching.suggestion = {
          ...matching.suggestion,
          ambiguous: true,
          rentalId: null,
        };
      const result: TollPreviewRow = {
        ...row,
        status: 'VALID',
        duplicateOf: null,
        ...matching,
      };
      if (new Date(value.occurredAt) > now) {
        result.status = 'INVALID';
        result.errors = [
          ...row.errors,
          'Thời điểm phí không được ở tương lai.',
        ];
        return result;
      }
      const key = value.externalReference
        ? 'r:' + value.externalReference
        : 'f:' + value.fingerprint;
      const prior = seen.get(key);
      const duplicate = existing.find((x) =>
        value.externalReference
          ? x.externalReference === value.externalReference
          : !x.externalReference && x.fingerprint === value.fingerprint,
      );
      if (prior || duplicate) {
        const same =
          (prior?.fingerprint ?? duplicate?.fingerprint) === value.fingerprint;
        result.status = same ? 'DUPLICATE' : 'CONFLICT';
        result.duplicateOf = duplicate?.id ?? `row:${prior!.rowNumber}`;
        result.errors = [
          same
            ? 'Dòng đã tồn tại trong nguồn/doanh nghiệp hoặc trong file.'
            : 'Mã tham chiếu bị trùng nhưng thông tin giao dịch khác.',
        ];
      } else
        seen.set(key, {
          fingerprint: value.fingerprint,
          rowNumber: row.rowNumber,
        });
      return result;
    });
    return {
      source,
      previewHash: parsed.contentHash,
      rows,
      summary: {
        total: rows.length,
        valid: rows.filter((x) => x.status === 'VALID').length,
        invalid: rows.filter((x) => x.status === 'INVALID').length,
        duplicate: rows.filter((x) => x.status === 'DUPLICATE').length,
        conflict: rows.filter((x) => x.status === 'CONFLICT').length,
      },
    };
  }
  async preview(c: TenantContext, body: TollImportPreview) {
    return this.locked(c, 'commercial.read', (tx, now) =>
      this.previewIn(tx, c, body, now),
    );
  }
  async import(c: TenantContext, body: TollImportConfirm, requestId: string) {
    if (
      !body ||
      !isUUID(body.idempotencyKey) ||
      !Array.isArray(body.rowNumbers) ||
      !body.rowNumbers.length ||
      body.rowNumbers.length > 200 ||
      new Set(body.rowNumbers).size !== body.rowNumbers.length ||
      body.rowNumbers.some((x) => !Number.isInteger(x) || x < 2 || x > 201)
    )
      throw invalid('Select up to 200 unique CSV data rows');
    return this.locked(c, 'commercial.manage', async (tx, now) => {
      const parsed = parseTollCsv(body);
      if (parsed.contentHash !== body.previewHash)
        throw conflict(
          'CSV or mapping changed; preview the file again',
          'TOLL_PREVIEW_CHANGED',
        );
      const selected = [...body.rowNumbers].sort((a, b) => a - b);
      const contentHash = hash([parsed.contentHash, selected]);
      const [prior] = await tx
        .select()
        .from(tollImportBatches)
        .where(
          and(
            eq(tollImportBatches.businessId, c.businessId),
            eq(tollImportBatches.idempotencyKey, body.idempotencyKey),
          ),
        );
      if (prior) {
        if (prior.contentHash !== contentHash)
          throw conflict(
            'Idempotency key belongs to another import',
            'TOLL_IDEMPOTENCY_CONFLICT',
          );
        return {
          batchId: prior.id,
          importedCount: prior.importedCount,
          duplicateCount: prior.duplicateCount,
          idempotent: true,
        };
      }
      const preview = await this.previewIn(tx, c, body, now);
      const rows = preview.rows.filter((x) => selected.includes(x.rowNumber));
      if (
        rows.length !== selected.length ||
        rows.some(
          (x) =>
            x.status === 'INVALID' ||
            x.status === 'CONFLICT' ||
            (x.status === 'DUPLICATE' &&
              x.duplicateOf?.startsWith('row:') &&
              !selected.includes(Number(x.duplicateOf.slice(4)))),
        )
      )
        throw invalid(
          'Selected rows contain invalid or conflicting data; preview and select again',
          'TOLL_IMPORT_ROWS_INVALID',
        );
      const valid = rows.filter((x) => x.status === 'VALID'),
        duplicates = rows.length - valid.length;
      const [batch] = await tx
        .insert(tollImportBatches)
        .values({
          businessId: c.businessId,
          source: preview.source,
          idempotencyKey: body.idempotencyKey,
          contentHash,
          rowCount: rows.length,
          importedCount: valid.length,
          duplicateCount: duplicates,
          createdBy: c.userId,
          createdAt: now,
        })
        .returning();
      for (const row of valid) {
        const value = row.normalized!;
        const [created] = await tx
          .insert(tollTransactions)
          .values({
            source: value.source,
            externalReference: value.externalReference,
            fingerprint: value.fingerprint,
            plate: value.plate,
            amount: value.amount,
            station: value.station,
            description: value.description,
            businessId: c.businessId,
            batchId: batch.id,
            occurredAt: new Date(value.occurredAt),
            importRow: row.rowNumber,
            status: row.suggestion.vehicleId ? 'NEEDS_REVIEW' : 'UNMATCHED',
            vehicleId: row.suggestion.vehicleId,
            rentalId: row.suggestion.ambiguous ? null : row.suggestion.rentalId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await this.event(
          tx,
          c,
          created,
          'IMPORTED',
          'Owner-provided CSV statement; payment not independently verified',
          now,
        );
      }
      await this.audit(tx, c, batch.id, 'toll.import', requestId, [
        'source',
        'normalizedRows',
      ]);
      return {
        batchId: batch.id,
        importedCount: valid.length,
        duplicateCount: duplicates,
        idempotent: false,
      };
    });
  }
  private async present(tx: Tx, c: TenantContext, rows: Toll[], now: Date) {
    const matches = await this.suggestions(tx, c, rows, now);
    const movementIds = rows.flatMap((row) =>
      row.movementId ? [row.movementId] : [],
    );
    const movements = movementIds.length
      ? await tx
          .select({
            id: commercialMovements.id,
            reversalOf: commercialMovements.reversalOf,
          })
          .from(commercialMovements)
          .where(
            and(
              eq(commercialMovements.businessId, c.businessId),
              or(
                inArray(commercialMovements.id, movementIds),
                inArray(commercialMovements.reversalOf, movementIds),
              ),
            ),
          )
      : [];
    return rows.map((row, index) => ({
      id: row.id,
      batchId: row.batchId,
      source: row.source,
      externalReference: row.externalReference,
      plate: row.plate,
      occurredAt: row.occurredAt,
      amount: row.amount,
      station: row.station,
      description: row.description,
      status: row.status,
      vehicleId: row.vehicleId,
      rentalId: row.rentalId,
      movementId: row.movementId,
      reviewReason: row.reviewReason,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...matches[index],
      movementStatus: row.movementId
        ? movements.some((m) => m.reversalOf === row.movementId)
          ? 'REVERSED'
          : 'POSTED'
        : null,
      reversedBy:
        movements.find((m) => m.reversalOf === row.movementId)?.id ?? null,
    }));
  }
  async list(c: TenantContext, q: TollQuery) {
    return this.locked(c, 'commercial.read', async (tx, now) => {
      const page = q.page ?? 1,
        limit = q.limit ?? 20;
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > 1000000 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
      )
        throw invalid('Invalid toll page');
      if (
        (q.from && !Number.isFinite(Date.parse(q.from))) ||
        (q.until && !Number.isFinite(Date.parse(q.until))) ||
        (q.from && q.until && new Date(q.from) >= new Date(q.until))
      )
        throw invalid('from must precede until', 'TOLL_INVALID_RANGE');
      if (q.vehicleId) {
        const [vehicle] = await tx
          .select({ id: vehicles.id })
          .from(vehicles)
          .where(
            and(
              eq(vehicles.businessId, c.businessId),
              eq(vehicles.id, q.vehicleId),
            ),
          );
        if (!vehicle) throw missing();
      }
      if (q.rentalId) {
        const [rental] = await tx
          .select()
          .from(rentals)
          .where(
            and(
              eq(rentals.businessId, c.businessId),
              eq(rentals.id, q.rentalId),
            ),
          );
        if (!rental || (q.vehicleId && rental.vehicleId !== q.vehicleId))
          throw missing();
      }
      const where = and(
        eq(tollTransactions.businessId, c.businessId),
        q.status ? eq(tollTransactions.status, q.status) : undefined,
        q.vehicleId ? eq(tollTransactions.vehicleId, q.vehicleId) : undefined,
        q.rentalId ? eq(tollTransactions.rentalId, q.rentalId) : undefined,
        q.from ? gte(tollTransactions.occurredAt, new Date(q.from)) : undefined,
        q.until
          ? lt(tollTransactions.occurredAt, new Date(q.until))
          : undefined,
      );
      const rows = await tx
        .select()
        .from(tollTransactions)
        .where(where)
        .orderBy(desc(tollTransactions.occurredAt), desc(tollTransactions.id))
        .limit(limit)
        .offset((page - 1) * limit);
      const [total] = await tx
        .select({ total: count() })
        .from(tollTransactions)
        .where(where);
      return {
        data: await this.present(tx, c, rows, now),
        page,
        limit,
        total: total.total,
      };
    });
  }
  async detail(c: TenantContext, id: string) {
    return this.locked(c, 'commercial.read', async (tx, now) => {
      const row = await this.get(tx, c, id);
      const [value] = await this.present(tx, c, [row], now);
      const history = await tx
        .select({
          id: tollReviewEvents.id,
          action: tollReviewEvents.action,
          actorId: tollReviewEvents.actorId,
          reason: tollReviewEvents.reason,
          vehicleId: tollReviewEvents.vehicleId,
          rentalId: tollReviewEvents.rentalId,
          status: tollReviewEvents.status,
          version: tollReviewEvents.version,
          createdAt: tollReviewEvents.createdAt,
        })
        .from(tollReviewEvents)
        .where(
          and(
            eq(tollReviewEvents.businessId, c.businessId),
            eq(tollReviewEvents.tollTransactionId, id),
          ),
        )
        .orderBy(
          desc(tollReviewEvents.version),
          desc(tollReviewEvents.createdAt),
          desc(tollReviewEvents.id),
        )
        .limit(100);
      return { ...value, history };
    });
  }
  async review(
    c: TenantContext,
    id: string,
    body: TollReview,
    requestId: string,
  ) {
    const reason = note(body?.reason);
    if (
      !body ||
      typeof body.ignore !== 'boolean' ||
      !Number.isInteger(body.version) ||
      !Object.hasOwn(body, 'vehicleId') ||
      !Object.hasOwn(body, 'rentalId') ||
      (body.vehicleId !== null && !isUUID(body.vehicleId)) ||
      (body.rentalId !== null && !isUUID(body.rentalId))
    )
      throw invalid(
        'Provide explicit vehicle/rental association, reason and current version',
      );
    return this.locked(c, 'commercial.manage', async (tx, now) => {
      const before = await this.get(tx, c, id);
      if (before.status === 'RECORDED')
        throw conflict(
          'A recorded toll is immutable; correct the linked movement through Commercial',
          'TOLL_ALREADY_RECORDED',
        );
      if (before.version !== body.version)
        throw conflict(
          'Toll was changed; refresh before reviewing',
          'TOLL_VERSION_CONFLICT',
        );
      if (!body.ignore && !body.vehicleId)
        throw invalid('A vehicle must be confirmed before recording');
      if (body.rentalId && !body.vehicleId)
        throw invalid('Rental requires its vehicle');
      if (body.vehicleId) {
        const [vehicle] = await tx
          .select({ id: vehicles.id })
          .from(vehicles)
          .where(
            and(
              eq(vehicles.businessId, c.businessId),
              eq(vehicles.id, body.vehicleId),
            ),
          );
        if (!vehicle) throw missing();
      }
      if (body.rentalId) {
        const [rental] = await tx
          .select()
          .from(rentals)
          .where(
            and(
              eq(rentals.businessId, c.businessId),
              eq(rentals.id, body.rentalId),
            ),
          );
        if (!rental || rental.vehicleId !== body.vehicleId) throw missing();
        if (!['ACTIVE', 'COMPLETED'].includes(rental.status))
          throw invalid(
            'Only active or completed rentals can be explicitly attributed',
          );
      }
      const [row] = await tx
        .update(tollTransactions)
        .set({
          status: body.ignore ? 'IGNORED' : 'MATCHED',
          vehicleId: body.vehicleId,
          rentalId: body.rentalId,
          reviewReason: reason,
          reviewedBy: c.userId,
          reviewedAt: now,
          version: before.version + 1,
          updatedAt: now,
        })
        .where(transactionWhere(c, id))
        .returning();
      await this.event(
        tx,
        c,
        row,
        body.ignore ? 'IGNORED' : 'MATCH_CONFIRMED',
        reason,
        now,
      );
      await this.audit(tx, c, id, 'toll.review', requestId, [
        'status',
        'vehicleId',
        'rentalId',
        'reviewReason',
      ]);
      return (await this.present(tx, c, [row], now))[0];
    });
  }
  private async recordIn(
    tx: Tx,
    c: TenantContext,
    id: string,
    body: TollRecord,
    requestId: string,
    now: Date,
    bulk: boolean,
  ) {
    const before = await this.get(tx, c, id);
    if (before.status === 'RECORDED')
      return (await this.present(tx, c, [before], now))[0];
    if (before.status !== 'MATCHED' || !before.vehicleId)
      throw conflict(
        'Confirm this toll match before approving an expense',
        'TOLL_NOT_MATCHED',
      );
    if (before.version !== body.version)
      throw conflict(
        'Toll was changed; refresh before recording',
        'TOLL_VERSION_CONFLICT',
      );
    const [match] = await this.suggestions(tx, c, [before], now);
    const duplicate =
      !!match.possibleDuplicateMovementIds.length || match.suggestion.ambiguous;
    if (
      bulk &&
      (duplicate ||
        match.suggestion.vehicleId !== before.vehicleId ||
        !match.suggestion.rentalId ||
        match.suggestion.rentalId !== before.rentalId)
    )
      throw conflict(
        'Bulk recording requires a current unique vehicle/rental match without possible duplicates',
        'TOLL_BULK_REVIEW_REQUIRED',
      );
    if (duplicate && !body.acknowledgePossibleDuplicate)
      throw conflict(
        'Review and explicitly acknowledge the possible duplicate before recording',
        'TOLL_POSSIBLE_DUPLICATE',
      );
    const movement = await recordTollExpense(
      tx,
      c,
      {
        vehicleId: before.vehicleId,
        rentalId: before.rentalId ?? undefined,
        amount: before.amount,
        occurredAt: before.occurredAt.toISOString(),
        reference: `TOLL:${before.id}`,
        notes: body.reason,
      },
      requestId,
    );
    const [row] = await tx
      .update(tollTransactions)
      .set({
        status: 'RECORDED',
        movementId: movement.id,
        reviewReason: body.reason,
        reviewedBy: c.userId,
        reviewedAt: now,
        version: before.version + 1,
        updatedAt: now,
      })
      .where(transactionWhere(c, id))
      .returning();
    await this.event(tx, c, row, 'RECORDED', body.reason, now);
    await this.audit(tx, c, id, 'toll.record', requestId, [
      'status',
      'movementId',
      'reviewReason',
    ]);
    return (await this.present(tx, c, [row], now))[0];
  }
  async record(
    c: TenantContext,
    id: string,
    body: TollRecord,
    requestId: string,
  ) {
    const reason = note(body?.reason);
    if (
      !Number.isInteger(body?.version) ||
      typeof body?.acknowledgePossibleDuplicate !== 'boolean'
    )
      throw invalid(
        'Provide current version and explicit duplicate acknowledgement',
      );
    return this.locked(c, 'commercial.manage', (tx, now) =>
      this.recordIn(
        tx,
        c,
        id,
        {
          version: body.version,
          acknowledgePossibleDuplicate: body.acknowledgePossibleDuplicate,
          reason,
        },
        requestId,
        now,
        false,
      ),
    );
  }
  async bulkRecord(c: TenantContext, body: TollBulkRecord, requestId: string) {
    const reason = note(body?.reason);
    if (
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.items.length > 20 ||
      body.items.some((x) => !isUUID(x.id) || !Number.isInteger(x.version)) ||
      new Set(body.items.map((x) => x.id)).size !== body.items.length
    )
      throw invalid(
        'Select up to twenty unique reviewed tolls with current versions',
      );
    return this.locked(c, 'commercial.manage', async (tx, now) => {
      const data = [];
      for (const item of body.items)
        data.push(
          await this.recordIn(
            tx,
            c,
            item.id,
            {
              version: item.version,
              reason,
              acknowledgePossibleDuplicate: false,
            },
            requestId,
            now,
            true,
          ),
        );
      return { data };
    });
  }
}
