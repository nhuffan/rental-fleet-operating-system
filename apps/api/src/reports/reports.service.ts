import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor } from '../auth/permissions.js';
import { CommercialService } from '../commercial/commercial.service.js';
import type { CommercialSummaryQuery } from '../commercial/dto.js';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  memberships,
  profiles,
} from '../database/schema.js';
import { toCsv } from './csv.js';
import {
  REPORT_DEFAULT_DAYS,
  REPORT_MAX_DAYS,
  REPORT_ROW_LIMIT,
  type ReportExport,
  type ReportQuery,
} from './dto.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Reader = Database['db'] | Tx;
const DAY_MS = 86_400_000;
const REVENUE_KINDS = sql`('RENTAL_PAYMENT','MISC_INCOME','DEPOSIT_RETAIN')`;
const SIGNED = sql`case when reversal_of is null then amount else -amount end`;
const iso = (column: string) =>
  sql.raw(
    `to_char(${column} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
  );

export function reportWindow(q: ReportQuery, now: Date) {
  const until = q.until ? new Date(q.until) : now;
  const from = q.from
    ? new Date(q.from)
    : new Date(until.getTime() - REPORT_DEFAULT_DAYS * DAY_MS);
  if (
    !Number.isFinite(until.getTime()) ||
    !Number.isFinite(from.getTime()) ||
    from >= until
  )
    throw new BadRequestException({
      code: 'INVALID_REPORT_RANGE',
      message: 'from must precede until',
    });
  if (until.getTime() - from.getTime() > REPORT_MAX_DAYS * DAY_MS)
    throw new BadRequestException({
      code: 'INVALID_REPORT_RANGE',
      message: `Range cannot exceed ${REPORT_MAX_DAYS} days`,
    });
  return { from, until };
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(CommercialService) private readonly commercial: CommercialService,
  ) {}

  private require(c: TenantContext) {
    if (!permissionsFor(c.role).includes('report.read'))
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
      });
  }

  private async now(db: Reader) {
    const result = await db.execute<{ now: string }>(
      sql`select clock_timestamp()::text as now`,
    );
    return new Date(result.rows[0].now);
  }

  async summary(c: TenantContext, q: ReportQuery) {
    this.require(c);
    const db = this.database.db;
    const { from, until } = reportWindow(q, await this.now(db));
    const f = from.toISOString(),
      u = until.toISOString();
    const base = await this.commercial.summary(c, {
      from: f,
      until: u,
    } as CommercialSummaryQuery);
    const windowSeconds = (until.getTime() - from.getTime()) / 1000;
    const months = await db.execute<{
      month: string;
      revenue: string;
      expenses: string;
    }>(sql`
      select to_char(date_trunc('month', occurred_at at time zone 'Asia/Ho_Chi_Minh'),'YYYY-MM') as month,
        coalesce(sum(case when kind in ${REVENUE_KINDS} then ${SIGNED} else 0 end),0)::text as revenue,
        coalesce(sum(case when kind = 'EXPENSE' then ${SIGNED} else 0 end),0)::text as expenses
      from public.commercial_movements
      where business_id = ${c.businessId} and occurred_at >= ${f}::timestamptz and occurred_at < ${u}::timestamptz
      group by 1 order by 1`);
    const statuses = await db.execute<{ status: string; count: number }>(sql`
      select status, count(*)::int as count from public.rentals
      where business_id = ${c.businessId} and start_at >= ${f}::timestamptz and start_at < ${u}::timestamptz
      group by status order by status`);
    const vehicles = await db.execute<{
      vehicleId: string;
      licensePlate: string;
      make: string;
      model: string;
      revenue: string;
      seconds: string;
    }>(sql`
      with occupied as (
        select r.vehicle_id, sum(greatest(0, extract(epoch from
          least(coalesce(r.returned_at, r.end_at), ${u}::timestamptz) - greatest(coalesce(r.handed_over_at, r.start_at), ${f}::timestamptz)))) as seconds
        from public.rentals r
        where r.business_id = ${c.businessId} and r.status in ('RESERVED','ACTIVE','COMPLETED')
          and coalesce(r.handed_over_at, r.start_at) < ${u}::timestamptz and coalesce(r.returned_at, r.end_at) > ${f}::timestamptz
        group by r.vehicle_id),
      earned as (
        select vehicle_id, sum(${SIGNED}) as revenue from public.commercial_movements
        where business_id = ${c.businessId} and vehicle_id is not null and kind in ${REVENUE_KINDS}
          and occurred_at >= ${f}::timestamptz and occurred_at < ${u}::timestamptz
        group by vehicle_id)
      select v.id as "vehicleId", v.license_plate as "licensePlate", v.make, v.model,
        coalesce(earned.revenue,0)::text as revenue, coalesce(occupied.seconds,0)::text as seconds
      from public.vehicles v
      left join occupied on occupied.vehicle_id = v.id
      left join earned on earned.vehicle_id = v.id
      where v.business_id = ${c.businessId} and v.status = 'ACTIVE'
      order by coalesce(earned.revenue,0) desc, coalesce(occupied.seconds,0) desc, v.id
      limit 50`);
    const [active] = (
      await db.execute<{ count: number }>(sql`
        select count(*)::int as count from public.vehicles where business_id = ${c.businessId} and status = 'ACTIVE'`)
    ).rows;
    const percent = (seconds: number) =>
      Math.min(100, Math.round((seconds / windowSeconds) * 1000) / 10);
    const rows = vehicles.rows.map((v) => {
      const seconds = Number(v.seconds);
      return {
        vehicleId: v.vehicleId,
        licensePlate: v.licensePlate,
        make: v.make,
        model: v.model,
        revenue: v.revenue,
        rentedHours: Math.round((seconds / 3600) * 10) / 10,
        utilizationPercent: percent(seconds),
      };
    });
    // The 50-row table is not the whole fleet, so fleet utilization uses its own aggregate.
    const [occupiedTotal] = (
      await db.execute<{ seconds: string }>(sql`
        select coalesce(sum(greatest(0, extract(epoch from
          least(coalesce(r.returned_at, r.end_at), ${u}::timestamptz) - greatest(coalesce(r.handed_over_at, r.start_at), ${f}::timestamptz)))),0)::text as seconds
        from public.rentals r join public.vehicles v on v.business_id = r.business_id and v.id = r.vehicle_id and v.status = 'ACTIVE'
        where r.business_id = ${c.businessId} and r.status in ('RESERVED','ACTIVE','COMPLETED')
          and coalesce(r.handed_over_at, r.start_at) < ${u}::timestamptz and coalesce(r.returned_at, r.end_at) > ${f}::timestamptz`)
    ).rows;
    const fleet = active.count
      ? Math.min(
          100,
          Math.round(
            (Number(occupiedTotal.seconds) / (windowSeconds * active.count)) *
              1000,
          ) / 10,
        )
      : 0;
    return {
      currency: base.currency,
      basis: base.basis,
      from: f,
      until: u,
      recordedRevenue: base.recordedRevenue,
      cashReceived: base.cashReceived,
      operatingExpenses: base.operatingExpenses,
      estimatedProfit: base.estimatedProfit,
      depositHeld: base.depositHeld,
      fleetUtilizationPercent: fleet,
      activeVehicles: active.count,
      months: months.rows.map((m) => ({
        month: m.month,
        revenue: m.revenue,
        expenses: m.expenses,
        estimatedProfit: (BigInt(m.revenue) - BigInt(m.expenses)).toString(),
      })),
      rentalsByStatus: statuses.rows,
      vehicles: rows,
    };
  }

  private async rows(
    tx: Tx,
    c: TenantContext,
    kind: ReportExport,
    f: string,
    u: string,
  ): Promise<{ headers: string[]; rows: unknown[][] }> {
    const cap = REPORT_ROW_LIMIT + 1;
    const take = <T extends Record<string, unknown>>(r: { rows: T[] }) => {
      if (r.rows.length > REPORT_ROW_LIMIT)
        throw new UnprocessableEntityException({
          code: 'REPORT_ROW_LIMIT',
          message: `Export is limited to ${REPORT_ROW_LIMIT} rows; narrow the range`,
        });
      return r.rows;
    };
    if (kind === 'vehicles') {
      const r = await tx.execute<Record<string, unknown>>(sql`
        select v.license_plate, v.make, v.model, v.status, ${iso('v.created_at')} as created_at
        from public.vehicles v where v.business_id = ${c.businessId} order by v.license_plate, v.id limit ${cap}`);
      return {
        headers: ['licensePlate', 'make', 'model', 'status', 'createdAt'],
        rows: take(r).map((x) => [
          x.license_plate,
          x.make,
          x.model,
          x.status,
          x.created_at,
        ]),
      };
    }
    if (kind === 'customers') {
      // Identification/driving-licence numbers, address and notes are never exported.
      const r = await tx.execute<Record<string, unknown>>(sql`
        select k.name, k.phone, k.email, k.status, ${iso('k.created_at')} as created_at
        from public.customers k where k.business_id = ${c.businessId} order by k.name, k.id limit ${cap}`);
      return {
        headers: ['name', 'phone', 'email', 'status', 'createdAt'],
        rows: take(r).map((x) => [
          x.name,
          x.phone,
          x.email,
          x.status,
          x.created_at,
        ]),
      };
    }
    if (kind === 'rentals') {
      const r = await tx.execute<Record<string, unknown>>(sql`
        select r.id, v.license_plate, k.name as customer, r.status, ${iso('r.start_at')} as start_at, ${iso('r.end_at')} as end_at,
          ${iso('r.returned_at')} as returned_at, r.rental_amount::text as rental_amount, r.deposit_required_amount::text as deposit
        from public.rentals r
        join public.vehicles v on v.business_id = r.business_id and v.id = r.vehicle_id
        join public.customers k on k.business_id = r.business_id and k.id = r.customer_id
        where r.business_id = ${c.businessId} and r.start_at >= ${f}::timestamptz and r.start_at < ${u}::timestamptz
        order by r.start_at desc, r.id limit ${cap}`);
      return {
        headers: [
          'rentalId',
          'licensePlate',
          'customer',
          'status',
          'startAt',
          'endAt',
          'returnedAt',
          'rentalAmount',
          'depositRequiredAmount',
        ],
        rows: take(r).map((x) => [
          x.id,
          x.license_plate,
          x.customer,
          x.status,
          x.start_at,
          x.end_at,
          x.returned_at,
          x.rental_amount,
          x.deposit,
        ]),
      };
    }
    const r = await tx.execute<Record<string, unknown>>(sql`
      select m.id, ${iso('m.occurred_at')} as occurred_at, m.kind, m.category, m.amount::text as amount,
        (m.reversal_of is not null) as is_reversal, v.license_plate, m.reference
      from public.commercial_movements m
      left join public.vehicles v on v.business_id = m.business_id and v.id = m.vehicle_id
      where m.business_id = ${c.businessId} and m.occurred_at >= ${f}::timestamptz and m.occurred_at < ${u}::timestamptz
      order by m.occurred_at desc, m.id limit ${cap}`);
    return {
      headers: [
        'movementId',
        'occurredAt',
        'kind',
        'category',
        'amount',
        'isReversal',
        'licensePlate',
        'reference',
      ],
      rows: take(r).map((x) => [
        x.id,
        x.occurred_at,
        x.kind,
        x.category,
        x.amount,
        x.is_reversal,
        x.license_plate,
        x.reference,
      ]),
    };
  }

  async exportCsv(
    c: TenantContext,
    kind: ReportExport,
    q: ReportQuery,
    requestId: string,
  ) {
    this.require(c);
    return this.database.db.transaction(async (tx) => {
      const [business] = await tx
        .select({ status: businesses.status })
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
      if (!permissionsFor(member.role).includes('report.read'))
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: 'Permission denied',
        });
      const { from, until } = reportWindow(q, await this.now(tx));
      const data = await this.rows(
        tx,
        c,
        kind,
        from.toISOString(),
        until.toISOString(),
      );
      await tx.insert(auditLogs).values({
        businessId: c.businessId,
        actorUserId: c.userId,
        action: 'report.export',
        entityType: 'report',
        entityId: c.businessId,
        metadata: { requestId, fields: [kind] },
      });
      return toCsv(data.headers, data.rows);
    });
  }
}
