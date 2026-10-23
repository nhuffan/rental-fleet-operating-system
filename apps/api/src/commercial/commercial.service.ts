import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor } from '../auth/permissions.js';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  commercialMovements,
  memberships,
  profiles,
  rentals,
  vehicles,
} from '../database/schema.js';
import {
  CommercialMovementCreate,
  CommercialMovementQuery,
  CommercialMovementReverse,
  CommercialSummaryQuery,
} from './dto.js';
import {
  commercialConflict,
  outstanding,
  requireCategory,
  roundRentalVnd,
} from './domain.js';
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Reader = Database['db'] | Tx;
const m = commercialMovements;
const missing = (code: string, message: string) =>
  new NotFoundException({ code, message });
const reversedBy = sql<
  string | null
>`(select correction.id from commercial_movements correction where correction.business_id = commercial_movements.business_id and correction.reversal_of = commercial_movements.id limit 1)`;
const status = sql<string>`case when ${m.reversalOf} is not null then 'REVERSAL' when ${reversedBy} is not null then 'REVERSED' else 'POSTED' end`;
const signAmount = sql`case when ${m.reversalOf} is null then ${m.amount} else -${m.amount} end`;
const depositDelta = sql`case when ${m.kind} = 'DEPOSIT_RECEIPT' then ${signAmount} when ${m.kind} in ('DEPOSIT_REFUND','DEPOSIT_RETAIN') then -(${signAmount}) else 0 end`;
const projection = {
  ...getTableColumns(m),
  reversedBy: reversedBy.as('reversed_by'),
  status: status.as('movement_status'),
};
const literalPattern = (value: string) =>
  `%${value.replace(/[\\%_]/g, '\\$&')}%`;
export function translateCommercialConflict(error: unknown): never {
  const visited = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const detail = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (detail.code === '23505' && detail.constraint?.includes('commercial'))
      throw commercialConflict(
        'COMMERCIAL_ALREADY_REVERSED',
        'Movement has already been reversed',
      );
    current = detail.cause;
  }
  throw error;
}
@Injectable()
export class CommercialService {
  constructor(@Inject(Database) private readonly database: Database) {}
  private read(c: TenantContext) {
    if (!permissionsFor(c.role).includes('commercial.read'))
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
      });
  }
  private async requireVnd(db: Reader, c: TenantContext) {
    const [business] = await db
      .select({ currency: businesses.currency })
      .from(businesses)
      .where(eq(businesses.id, c.businessId));
    if (business?.currency !== 'VND')
      throw commercialConflict(
        'COMMERCIAL_CURRENCY_UNSUPPORTED',
        'Commercial movements currently support VND businesses only',
      );
  }
  private async now(db: Reader) {
    const result = await db.execute<{ now: string }>(
      sql`select clock_timestamp()::text as now`,
    );
    return new Date(result.rows[0].now);
  }
  private window(q: CommercialSummaryQuery, now: Date) {
    const until = q.until ? new Date(q.until) : now;
    const from = q.from ? new Date(q.from) : undefined;
    if (
      !Number.isFinite(until.getTime()) ||
      (from && (!Number.isFinite(from.getTime()) || from >= until))
    )
      throw new BadRequestException({
        code: 'INVALID_COMMERCIAL_RANGE',
        message: 'from must precede until',
      });
    return { from, until };
  }
  private async rental(db: Reader, c: TenantContext, id: string) {
    const [row] = await db
      .select()
      .from(rentals)
      .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
    if (!row) throw missing('RENTAL_NOT_FOUND', 'Rental not found');
    return row;
  }
  private async scope(
    db: Reader,
    c: TenantContext,
    q: { vehicleId?: string; rentalId?: string },
  ) {
    let vehicleId = q.vehicleId;
    if (q.rentalId) {
      const rental = await this.rental(db, c, q.rentalId);
      if (vehicleId && vehicleId !== rental.vehicleId)
        throw new BadRequestException({
          code: 'COMMERCIAL_SCOPE_MISMATCH',
          message: 'Vehicle does not match rental',
        });
      vehicleId = rental.vehicleId;
    }
    if (vehicleId) {
      const [vehicle] = await db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
          and(
            eq(vehicles.businessId, c.businessId),
            eq(vehicles.id, vehicleId),
          ),
        );
      if (!vehicle) throw missing('VEHICLE_NOT_FOUND', 'Vehicle not found');
    }
    return { vehicleId, rentalId: q.rentalId };
  }
  private scopeWhere(
    c: TenantContext,
    q: { vehicleId?: string; rentalId?: string },
  ) {
    return and(
      eq(m.businessId, c.businessId),
      q.vehicleId ? eq(m.vehicleId, q.vehicleId) : undefined,
      q.rentalId ? eq(m.rentalId, q.rentalId) : undefined,
    );
  }
  private async get(db: Reader, c: TenantContext, id: string) {
    const [row] = await db
      .select(projection)
      .from(m)
      .where(and(eq(m.businessId, c.businessId), eq(m.id, id)));
    if (!row)
      throw missing('COMMERCIAL_MOVEMENT_NOT_FOUND', 'Movement not found');
    return row;
  }
  async detail(c: TenantContext, id: string) {
    this.read(c);
    await this.requireVnd(this.database.db, c);
    return this.get(this.database.db, c, id);
  }
  async list(c: TenantContext, q: CommercialMovementQuery) {
    this.read(c);
    const db = this.database.db;
    await this.requireVnd(db, c);
    const scope = await this.scope(db, c, q);
    const { from, until } = this.window(q, await this.now(db));
    const where = and(
      this.scopeWhere(c, scope),
      from ? gte(m.occurredAt, from) : undefined,
      lt(m.occurredAt, until),
      q.kind ? eq(m.kind, q.kind) : undefined,
      q.category ? eq(m.category, q.category) : undefined,
      q.status ? sql`${status} = ${q.status}` : undefined,
      q.search
        ? or(
            ilike(m.reference, literalPattern(q.search)),
            ilike(m.notes, literalPattern(q.search)),
          )
        : undefined,
    );
    const data = await db
      .select(projection)
      .from(m)
      .where(where)
      .orderBy(desc(m.occurredAt), desc(m.id))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);
    const [total] = await db.select({ value: count() }).from(m).where(where);
    return { data, page: q.page, limit: q.limit, total: total.value };
  }
  private sum(where: SQL | undefined) {
    return sql<string>`coalesce(sum(case when ${where} then ${signAmount} else 0 end),0)::text`;
  }
  private async totals(
    db: Reader,
    c: TenantContext,
    q: CommercialSummaryQuery,
    now: Date,
  ) {
    await this.requireVnd(db, c);
    const scope = await this.scope(db, c, q);
    const { from, until } = this.window(q, now);
    const inWindow = from ? gte(m.occurredAt, from) : sql`true`;
    const [totals] = await db
      .select({
        payments: this.sum(and(inWindow, eq(m.kind, 'RENTAL_PAYMENT'))),
        miscellaneous: this.sum(and(inWindow, eq(m.kind, 'MISC_INCOME'))),
        retained: this.sum(and(inWindow, eq(m.kind, 'DEPOSIT_RETAIN'))),
        expenses: this.sum(and(inWindow, eq(m.kind, 'EXPENSE'))),
        receivedDeposit: this.sum(eq(m.kind, 'DEPOSIT_RECEIPT')),
        refundedDeposit: this.sum(eq(m.kind, 'DEPOSIT_REFUND')),
        retainedDeposit: this.sum(eq(m.kind, 'DEPOSIT_RETAIN')),
      })
      .from(m)
      .where(and(this.scopeWhere(c, scope), lt(m.occurredAt, until)));
    const cashReceived = BigInt(totals.payments) + BigInt(totals.miscellaneous);
    const revenue = cashReceived + BigInt(totals.retained);
    const expenses = BigInt(totals.expenses);
    const depositHeld =
      BigInt(totals.receivedDeposit) -
      BigInt(totals.refundedDeposit) -
      BigInt(totals.retainedDeposit);
    return {
      totals,
      summary: {
        currency: 'VND',
        basis: 'RECORDED_MOVEMENTS',
        from: from?.toISOString() ?? null,
        until: until.toISOString(),
        recordedRevenue: revenue.toString(),
        cashReceived: cashReceived.toString(),
        operatingExpenses: expenses.toString(),
        estimatedProfit: (revenue - expenses).toString(),
        netOperatingCashFlow: (cashReceived - expenses).toString(),
        depositHeld: depositHeld.toString(),
      },
    };
  }
  async summary(c: TenantContext, q: CommercialSummaryQuery) {
    this.read(c);
    return (
      await this.totals(
        this.database.db,
        c,
        q,
        await this.now(this.database.db),
      )
    ).summary;
  }
  async rentalSummary(c: TenantContext, id: string) {
    this.read(c);
    const db = this.database.db;
    const rental = await this.rental(db, c, id);
    const { totals, summary } = await this.totals(
      db,
      c,
      { rentalId: id },
      await this.now(db),
    );
    const contractedAmount = roundRentalVnd(rental.rentalAmount);
    return {
      rentalId: id,
      vehicleId: rental.vehicleId,
      currency: 'VND',
      contractedAmount,
      recordedRentalPayments: totals.payments,
      ...outstanding(contractedAmount, totals.payments),
      depositRequired: roundRentalVnd(rental.depositRequiredAmount),
      depositReceived: totals.receivedDeposit,
      depositRefunded: totals.refundedDeposit,
      depositRetained: totals.retainedDeposit,
      depositBalance: summary.depositHeld,
      summary,
    };
  }
  private async mutate<T>(
    c: TenantContext,
    requestId: string,
    action: string,
    operation: (
      tx: Tx,
      now: Date,
    ) => Promise<{ id: string; value: T; fields: string[] }>,
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
              eq(memberships.businessId, c.businessId),
              eq(memberships.id, c.membershipId),
              eq(memberships.userId, c.userId),
              eq(memberships.status, 'ACTIVE'),
              eq(profiles.status, 'ACTIVE'),
            ),
          );
        if (!member || business?.status !== 'ACTIVE') throw denied();
        if (!permissionsFor(member.role).includes('commercial.manage'))
          throw new ForbiddenException({
            code: 'PERMISSION_DENIED',
            message: 'Permission denied',
          });
        if (business.currency !== 'VND')
          throw commercialConflict(
            'COMMERCIAL_CURRENCY_UNSUPPORTED',
            'Commercial movements currently support VND businesses only',
          );
        const result = await operation(tx, await this.now(tx));
        await tx.insert(auditLogs).values({
          businessId: c.businessId,
          actorUserId: c.userId,
          action,
          entityType: 'commercial_movement',
          entityId: result.id,
          metadata: { requestId, fields: result.fields },
        });
        return result.value;
      });
    } catch (error) {
      return translateCommercialConflict(error);
    }
  }
  private async verifyDepositHistory(
    tx: Tx,
    c: TenantContext,
    rentalId: string,
  ) {
    // Group simultaneous events, then check every historical prefix, not only today's balance.
    const result = await tx.execute<{ minimum: string }>(sql`
      select coalesce(min(balance),0)::text as minimum from (
        select sum(delta) over (order by occurred_at rows between unbounded preceding and current row) as balance from (
          select ${m.occurredAt} as occurred_at,sum(${depositDelta}) as delta from ${m}
          where ${m.businessId}=${c.businessId} and ${m.rentalId}=${rentalId}
          group by ${m.occurredAt}
        ) grouped
      ) history`);
    if (BigInt(result.rows[0].minimum) < 0n)
      throw commercialConflict(
        'INSUFFICIENT_DEPOSIT_BALANCE',
        'Movement would make the rental deposit balance negative at a recorded date',
      );
  }
  async create(
    c: TenantContext,
    body: CommercialMovementCreate,
    requestId: string,
  ) {
    requireCategory(body.kind, body.category, body.rentalId);
    return this.mutate(c, requestId, 'commercial.create', async (tx, now) => {
      const occurredAt = new Date(body.occurredAt);
      if (!Number.isFinite(occurredAt.getTime()) || occurredAt > now)
        throw new BadRequestException({
          code: 'INVALID_COMMERCIAL_DATE',
          message: 'Movement date cannot be in the future',
        });
      const scope = await this.scope(tx, c, body);
      const [row] = await tx
        .insert(m)
        .values({
          ...scope,
          businessId: c.businessId,
          kind: body.kind,
          category: body.category,
          amount: body.amount,
          occurredAt,
          reference: body.reference ?? '',
          notes: body.notes ?? '',
          createdBy: c.userId,
          createdAt: now,
        })
        .returning({ id: m.id });
      if (body.kind.startsWith('DEPOSIT_'))
        await this.verifyDepositHistory(tx, c, body.rentalId!);
      return {
        id: row.id,
        value: await this.get(tx, c, row.id),
        fields: [
          'kind',
          'category',
          'amount',
          'occurredAt',
          ...Object.keys(body).filter((k) =>
            ['vehicleId', 'rentalId', 'reference', 'notes'].includes(k),
          ),
        ],
      };
    });
  }
  async reverse(
    c: TenantContext,
    id: string,
    body: CommercialMovementReverse,
    requestId: string,
  ) {
    return this.mutate(c, requestId, 'commercial.reverse', async (tx, now) => {
      const original = await this.get(tx, c, id);
      if (original.reversalOf)
        throw commercialConflict(
          'COMMERCIAL_REVERSAL_NOT_ALLOWED',
          'A reversal cannot itself be reversed',
        );
      if (original.reversedBy)
        throw commercialConflict(
          'COMMERCIAL_ALREADY_REVERSED',
          'Movement has already been reversed',
        );
      const [row] = await tx
        .insert(m)
        .values({
          businessId: c.businessId,
          vehicleId: original.vehicleId,
          rentalId: original.rentalId,
          kind: original.kind,
          category: original.category,
          amount: original.amount,
          occurredAt: now,
          reference: original.reference,
          notes: body.reason,
          createdBy: c.userId,
          createdAt: now,
          reversalOf: id,
        })
        .returning({ id: m.id });
      if (original.kind.startsWith('DEPOSIT_'))
        await this.verifyDepositHistory(tx, c, original.rentalId!);
      return {
        id: row.id,
        value: await this.get(tx, c, row.id),
        fields: ['reversalOf', 'notes'],
      };
    });
  }
}
