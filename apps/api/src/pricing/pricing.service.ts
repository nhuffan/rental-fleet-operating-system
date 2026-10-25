import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  gt,
  isNull,
  isNotNull,
  lt,
  lte,
  ne,
  or,
} from 'drizzle-orm';
import { isUUID } from 'class-validator';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  memberships,
  profiles,
  rentalRateCards,
  rentalQuoteSnapshots,
  vehicles,
} from '../database/schema.js';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor, type Permission } from '../auth/permissions.js';
import {
  calculateQuote,
  createQuoteHash,
  parsePricingInstant,
  PricingInputError,
  type RateInput,
} from './engine.js';
import {
  type QuotePreviewInput,
  type RateCardCreate,
  type RateCardDelete,
  type RateCardQuery,
  type RateCardUpdate,
  type RentalPricingSelection,
} from './dto.js';
import {
  type PricingQuoteResponse,
  type PricingSnapshotResponse,
  type RateCardResponse,
} from './responses.js';
export type PricingTx = Parameters<
  Parameters<Database['db']['transaction']>[0]
>[0];
type Rate = typeof rentalRateCards.$inferSelect;
type Snapshot = typeof rentalQuoteSnapshots.$inferSelect;
const invalid = (message: string, code = 'PRICING_INVALID_REQUEST') =>
  new BadRequestException({ code, message });
const conflict = (message: string, code: string) =>
  new ConflictException({ code, message });
const rateWhere = (c: TenantContext, id: string) =>
  and(eq(rentalRateCards.businessId, c.businessId), eq(rentalRateCards.id, id));
const missing = () =>
  new NotFoundException({
    code: 'RATE_NOT_FOUND',
    message: 'Rate card not found',
  });
const positiveMoney = (value: unknown) =>
  typeof value === 'string' && /^[1-9][0-9]{0,8}$/.test(value);
const wholeMoney = (value: unknown) =>
  typeof value === 'string' && /^(0|[1-9][0-9]{0,8})$/.test(value);
function translate(error: unknown): never {
  if (error instanceof PricingInputError)
    throw invalid(error.message, error.code);
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const e = current as { code?: string; cause?: unknown };
    if (e.code === '23P01')
      throw conflict(
        'Active rate ranges overlap for this scope',
        'RATE_OVERLAP',
      );
    if (e.code === '23503')
      throw conflict(
        'A confirmed quotation uses this rate card; deactivate it instead',
        'RATE_IN_USE',
      );
    current = e.cause;
  }
  throw error;
}
function instant(value: string) {
  try {
    return parsePricingInstant(value);
  } catch (error) {
    return translate(error);
  }
}
export function presentRate(
  row: Rate,
  vehiclePlate: string | null = null,
): RateCardResponse {
  return {
    id: row.id,
    name: row.name,
    vehicleId: row.vehicleId,
    vehiclePlate,
    scope: row.vehicleId ? 'VEHICLE' : 'BUSINESS',
    hourlyRate: row.hourlyRate,
    dailyRate: row.dailyRate,
    minimumCharge: row.minimumCharge,
    extraHourRate: row.extraHourRate,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveUntil: row.effectiveUntil?.toISOString() ?? null,
    status: row.status as 'ACTIVE' | 'INACTIVE',
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function presentPricingSnapshot(
  row: Snapshot | null,
): PricingSnapshotResponse | null {
  return row
    ? {
        id: row.id,
        rentalId: row.rentalId,
        vehicleId: row.vehicleId,
        rateCardId: row.rateCardId,
        mode: row.mode,
        breakdown: row.breakdown,
        agreedAmount: row.agreedAmount,
        overrideReason: row.overrideReason,
        createdAt: row.createdAt.toISOString(),
        createdBy: row.createdBy,
      }
    : null;
}
async function activeVehicle(
  tx: PricingTx,
  c: TenantContext,
  id: string,
  requireActive = true,
) {
  if (!isUUID(id)) throw invalid('Vehicle must be a UUID');
  const [vehicle] = await tx
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.businessId, c.businessId), eq(vehicles.id, id)));
  if (!vehicle)
    throw new NotFoundException({
      code: 'VEHICLE_NOT_FOUND',
      message: 'Vehicle not found',
    });
  if (requireActive && vehicle.status !== 'ACTIVE')
    throw conflict('Vehicle must be active', 'VEHICLE_INACTIVE');
  return vehicle;
}
/** Runs inside a caller-owned tenant transaction; reads only, never creates a quote or money record. */
export async function previewPricing(
  tx: PricingTx,
  c: TenantContext,
  input: QuotePreviewInput,
): Promise<PricingQuoteResponse> {
  if (input.timeZone !== 'Asia/Ho_Chi_Minh')
    throw invalid('Pricing uses Asia/Ho_Chi_Minh', 'INVALID_PRICING_TIMEZONE');
  if (
    input.billingMode !== undefined &&
    !['HOURLY', 'DAILY'].includes(input.billingMode)
  )
    throw invalid('Invalid billing mode');
  const startAt = instant(input.startAt),
    endAt = instant(input.endAt);
  if (endAt <= startAt)
    throw invalid('Return time must be after pickup', 'INVALID_PRICING_TIME');
  const vehicle = await activeVehicle(tx, c, input.vehicleId);
  const eligible = await tx
    .select()
    .from(rentalRateCards)
    .where(
      and(
        eq(rentalRateCards.businessId, c.businessId),
        eq(rentalRateCards.status, 'ACTIVE'),
        or(
          eq(rentalRateCards.vehicleId, input.vehicleId),
          isNull(rentalRateCards.vehicleId),
        ),
        lte(rentalRateCards.effectiveFrom, startAt),
        or(
          isNull(rentalRateCards.effectiveUntil),
          gt(rentalRateCards.effectiveUntil, startAt),
        ),
      ),
    )
    .orderBy(asc(rentalRateCards.id))
    .limit(3);
  const chosen =
    eligible.find((rate) => rate.vehicleId === input.vehicleId) ??
    eligible.find((rate) => rate.vehicleId === null);
  const rate = chosen
    ? presentRate(chosen, chosen.vehicleId ? vehicle.licensePlate : null)
    : null;
  const common = {
    currency: 'VND' as const,
    timeZone: 'Asia/Ho_Chi_Minh' as const,
    vehicleId: input.vehicleId,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  };
  if (
    !chosen ||
    (input.billingMode === 'HOURLY' && !chosen.hourlyRate) ||
    (input.billingMode === 'DAILY' && !chosen.dailyRate)
  ) {
    const reason = chosen ? 'BILLING_MODE_UNAVAILABLE' : 'NO_RATE';
    return {
      ...common,
      available: false,
      reason,
      quoteHash: createQuoteHash([
        'unavailable',
        c.businessId,
        common.vehicleId,
        common.startAt,
        common.endAt,
        input.billingMode ?? null,
        reason,
        chosen?.id ?? null,
        chosen?.version ?? null,
      ]),
      billingMode: input.billingMode ?? null,
      totalAmount: null,
      rate,
      breakdown: null,
    };
  }
  try {
    const engineRate: RateInput = {
      id: chosen.id,
      name: chosen.name,
      version: chosen.version,
      scope: chosen.vehicleId ? 'VEHICLE' : 'BUSINESS',
      hourlyRate: chosen.hourlyRate,
      dailyRate: chosen.dailyRate,
      minimumCharge: chosen.minimumCharge,
      extraHourRate: chosen.extraHourRate,
      effectiveFrom: chosen.effectiveFrom,
      effectiveUntil: chosen.effectiveUntil,
    };
    const breakdown = calculateQuote(engineRate, {
      vehicleId: input.vehicleId,
      startAt: common.startAt,
      endAt: common.endAt,
      billingMode: input.billingMode,
    });
    return {
      ...common,
      available: true,
      reason: null,
      quoteHash: breakdown.quoteHash,
      billingMode: breakdown.billingMode,
      totalAmount: breakdown.calculatedAmount,
      rate,
      breakdown,
    };
  } catch (error) {
    return translate(error);
  }
}
/** Resolve an explicitly reviewed selection again under the rental's existing tenant lock. */
export async function resolveRentalPricing(
  tx: PricingTx,
  c: TenantContext,
  booking: { vehicleId: string; startAt: string | Date; endAt: string | Date },
  selection: RentalPricingSelection,
) {
  const [business] = await tx
    .select({ currency: businesses.currency })
    .from(businesses)
    .where(eq(businesses.id, c.businessId));
  if (business?.currency !== 'VND')
    throw conflict(
      'Rental quotation supports VND businesses only',
      'PRICING_CURRENCY_UNSUPPORTED',
    );
  const quote = await previewPricing(tx, c, {
    ...booking,
    startAt:
      booking.startAt instanceof Date
        ? booking.startAt.toISOString()
        : booking.startAt,
    endAt:
      booking.endAt instanceof Date
        ? booking.endAt.toISOString()
        : booking.endAt,
    billingMode: selection.billingMode,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  if (selection.expectedQuoteHash !== quote.quoteHash)
    throw conflict(
      'Pricing changed; review a fresh quotation before confirmation',
      'PRICING_PREVIEW_CHANGED',
    );
  const hasOverride = selection.overrideAmount !== undefined;
  if (hasOverride) {
    if (!wholeMoney(selection.overrideAmount))
      throw invalid('Agreed amount must be whole VND up to 999999999');
    const reason = selection.overrideReason?.trim();
    if (!reason || reason.length > 2000)
      throw invalid(
        'A nonblank reason up to 2000 characters is required',
        'PRICING_REASON_REQUIRED',
      );
    return {
      quote,
      agreedAmount: selection.overrideAmount!,
      mode: quote.available ? ('OVERRIDE' as const) : ('MANUAL' as const),
      overrideReason: reason,
    };
  }
  if (selection.overrideReason !== undefined)
    throw invalid(
      'A reason must accompany an explicit agreed amount',
      'PRICING_MANUAL_AMOUNT_REQUIRED',
    );
  if (!quote.available || !quote.totalAmount)
    throw invalid(
      'No quotation is available; specify a manual agreement and reason',
      'PRICING_MANUAL_AMOUNT_REQUIRED',
    );
  return {
    quote,
    agreedAmount: quote.totalAmount,
    mode: 'CALCULATED' as const,
    overrideReason: null,
  };
}
@Injectable()
export class PricingService {
  constructor(@Inject(Database) private readonly database: Database) {}
  private async locked<T>(
    c: TenantContext,
    permission: Permission,
    operation: (tx: PricingTx) => Promise<T>,
  ) {
    try {
      return await this.database.db.transaction(async (tx) => {
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
            'Rental quotation supports VND businesses only',
            'PRICING_CURRENCY_UNSUPPORTED',
          );
        return operation(tx);
      });
    } catch (error) {
      return translate(error);
    }
  }
  private async get(tx: PricingTx, c: TenantContext, id: string) {
    const [rate] = await tx
      .select()
      .from(rentalRateCards)
      .where(rateWhere(c, id));
    if (!rate) throw missing();
    return rate;
  }
  private async audit(
    tx: PricingTx,
    c: TenantContext,
    id: string,
    action: string,
    requestId: string,
    fields: string[],
  ) {
    await tx.insert(auditLogs).values({
      businessId: c.businessId,
      actorUserId: c.userId,
      entityType: 'rental_rate_card',
      entityId: id,
      action,
      metadata: { requestId, fields },
    });
  }
  private async values(tx: PricingTx, c: TenantContext, body: RateCardCreate) {
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 120
    )
      throw invalid('A rate name up to 120 characters is required');
    if (body.vehicleId !== undefined && body.vehicleId !== null)
      await activeVehicle(tx, c, body.vehicleId, body.status !== 'INACTIVE');
    const hourlyRate = body.hourlyRate ?? null,
      dailyRate = body.dailyRate ?? null,
      extraHourRate = body.extraHourRate ?? null,
      minimumCharge = body.minimumCharge ?? '0';
    if (
      (hourlyRate !== null && !positiveMoney(hourlyRate)) ||
      (dailyRate !== null && !positiveMoney(dailyRate)) ||
      (!hourlyRate && !dailyRate) ||
      !wholeMoney(minimumCharge) ||
      (extraHourRate !== null && (!positiveMoney(extraHourRate) || !dailyRate))
    )
      throw invalid(
        'Provide positive whole-VND hourly/daily rates; extra-hour pricing requires a daily rate',
      );
    const effectiveFrom = instant(body.effectiveFrom),
      effectiveUntil =
        body.effectiveUntil == null ? null : instant(body.effectiveUntil);
    if (effectiveUntil && effectiveUntil <= effectiveFrom)
      throw invalid('Rate end must be after its start', 'INVALID_PRICING_TIME');
    const status = body.status ?? 'ACTIVE';
    if (!['ACTIVE', 'INACTIVE'].includes(status))
      throw invalid('Invalid rate status');
    return {
      name: body.name.trim(),
      vehicleId: body.vehicleId ?? null,
      hourlyRate,
      dailyRate,
      extraHourRate,
      minimumCharge,
      effectiveFrom,
      effectiveUntil,
      status,
    };
  }
  private async overlap(
    tx: PricingTx,
    c: TenantContext,
    values: Awaited<ReturnType<PricingService['values']>>,
    id?: string,
  ) {
    if (values.status !== 'ACTIVE') return;
    const [other] = await tx
      .select({ id: rentalRateCards.id })
      .from(rentalRateCards)
      .where(
        and(
          eq(rentalRateCards.businessId, c.businessId),
          values.vehicleId
            ? eq(rentalRateCards.vehicleId, values.vehicleId)
            : isNull(rentalRateCards.vehicleId),
          eq(rentalRateCards.status, 'ACTIVE'),
          id ? ne(rentalRateCards.id, id) : undefined,
          or(
            isNull(rentalRateCards.effectiveUntil),
            gt(rentalRateCards.effectiveUntil, values.effectiveFrom),
          ),
          values.effectiveUntil
            ? lt(rentalRateCards.effectiveFrom, values.effectiveUntil)
            : undefined,
        ),
      )
      .limit(1);
    if (other)
      throw conflict(
        'Active rate ranges overlap for this scope',
        'RATE_OVERLAP',
      );
  }
  async list(c: TenantContext, q: RateCardQuery) {
    return this.locked(c, 'rental.read', async (tx) => {
      const where = and(
        eq(rentalRateCards.businessId, c.businessId),
        q.vehicleId ? eq(rentalRateCards.vehicleId, q.vehicleId) : undefined,
        q.scope === 'BUSINESS'
          ? isNull(rentalRateCards.vehicleId)
          : q.scope === 'VEHICLE'
            ? isNotNull(rentalRateCards.vehicleId)
            : undefined,
        q.status ? eq(rentalRateCards.status, q.status) : undefined,
      );
      const [rows, totals] = await Promise.all([
        tx
          .select({ rate: rentalRateCards, plate: vehicles.licensePlate })
          .from(rentalRateCards)
          .leftJoin(
            vehicles,
            and(
              eq(vehicles.businessId, c.businessId),
              eq(vehicles.id, rentalRateCards.vehicleId),
            ),
          )
          .where(where)
          .orderBy(asc(rentalRateCards.effectiveFrom), asc(rentalRateCards.id))
          .limit(q.limit)
          .offset((q.page - 1) * q.limit),
        tx.select({ total: count() }).from(rentalRateCards).where(where),
      ]);
      return {
        data: rows.map((row) => presentRate(row.rate, row.plate)),
        page: q.page,
        limit: q.limit,
        total: totals[0].total,
      };
    });
  }
  async detail(c: TenantContext, id: string) {
    return this.locked(c, 'rental.read', async (tx) => {
      const rate = await this.get(tx, c, id);
      const plate = rate.vehicleId
        ? (await activeVehicle(tx, c, rate.vehicleId, false)).licensePlate
        : null;
      return presentRate(rate, plate);
    });
  }
  async preview(c: TenantContext, input: QuotePreviewInput) {
    return this.locked(c, 'rental.read', (tx) => previewPricing(tx, c, input));
  }
  async create(c: TenantContext, body: RateCardCreate, requestId: string) {
    return this.locked(c, 'rental.manage', async (tx) => {
      const values = await this.values(tx, c, body);
      await this.overlap(tx, c, values);
      const [rate] = await tx
        .insert(rentalRateCards)
        .values({ ...values, businessId: c.businessId, createdBy: c.userId })
        .returning();
      await this.audit(
        tx,
        c,
        rate.id,
        'rental_rate.create',
        requestId,
        Object.keys(values),
      );
      const plate = rate.vehicleId
        ? (await activeVehicle(tx, c, rate.vehicleId, false)).licensePlate
        : null;
      return presentRate(rate, plate);
    });
  }
  async update(
    c: TenantContext,
    id: string,
    body: RateCardUpdate,
    requestId: string,
  ) {
    return this.locked(c, 'rental.manage', async (tx) => {
      const before = await this.get(tx, c, id);
      if (before.version !== body.version)
        throw conflict(
          'Rate card was changed by another request',
          'RATE_VERSION_CHANGED',
        );
      const values = await this.values(tx, c, body);
      await this.overlap(tx, c, values, id);
      const [rate] = await tx
        .update(rentalRateCards)
        .set({ ...values, version: before.version + 1, updatedAt: new Date() })
        .where(rateWhere(c, id))
        .returning();
      await this.audit(
        tx,
        c,
        id,
        'rental_rate.update',
        requestId,
        Object.keys(values),
      );
      const plate = rate.vehicleId
        ? (await activeVehicle(tx, c, rate.vehicleId, false)).licensePlate
        : null;
      return presentRate(rate, plate);
    });
  }
  async delete(
    c: TenantContext,
    id: string,
    body: RateCardDelete,
    requestId: string,
  ) {
    return this.locked(c, 'rental.manage', async (tx) => {
      const rate = await this.get(tx, c, id);
      if (rate.version !== body.version)
        throw conflict(
          'Rate card was changed by another request',
          'RATE_VERSION_CHANGED',
        );
      const [used] = await tx
        .select({ id: rentalQuoteSnapshots.id })
        .from(rentalQuoteSnapshots)
        .where(
          and(
            eq(rentalQuoteSnapshots.businessId, c.businessId),
            eq(rentalQuoteSnapshots.rateCardId, id),
          ),
        )
        .limit(1);
      if (used)
        throw conflict(
          'A confirmed quotation uses this rate card; deactivate it instead',
          'RATE_IN_USE',
        );
      await tx.delete(rentalRateCards).where(rateWhere(c, id));
      await this.audit(tx, c, id, 'rental_rate.delete', requestId, ['deleted']);
      return { deleted: true };
    });
  }
}
