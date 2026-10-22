import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  not,
  notExists,
  or,
  sql,
} from 'drizzle-orm';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  customers,
  memberships,
  profiles,
  rentals,
  vehicles,
} from '../database/schema.js';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor, type Permission } from '../auth/permissions.js';
import {
  CustomerCreate,
  CustomerQuery,
  CustomerUpdate,
  RentalCancel,
  RentalCreate,
  RentalExtend,
  RentalHandover,
  RentalQuery,
  RentalReturn,
  RentalUpdate,
  VehicleAvailabilityQuery,
} from './dto.js';
import {
  isOverdue,
  rentalConflict,
  rentalWindow,
  requireRentalStatus,
} from './domain.js';
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Reader = Database['db'] | Tx;
const changedFields = (body: object) =>
  Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
const searchPattern = (value: string) =>
  `%${value.replace(/[\\%_]/g, '\\$&')}%`;
const missing = (code: string, message: string) =>
  new NotFoundException({ code, message });
const money = (value: number | undefined) =>
  value === undefined ? undefined : value.toFixed(2);
export function translateRentalConflict(error: unknown): never {
  const visited = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const detail = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (
      detail.code === '23P01' &&
      detail.constraint === 'rentals_blocking_vehicle_time_exclusion'
    )
      throw rentalConflict(
        'RENTAL_CONFLICT',
        'Vehicle has another reservation or active rental during this period',
      );
    if (
      detail.code === '23505' &&
      detail.constraint === 'rentals_active_vehicle_unique'
    )
      throw rentalConflict(
        'VEHICLE_RENTED',
        'Vehicle already has an active rental',
      );
    current = detail.cause;
  }
  throw error;
}
@Injectable()
export class RentalService {
  constructor(@Inject(Database) private readonly database: Database) {}
  private async now(db: Reader) {
    const result = await db.execute<{ now: string }>(
      sql`select clock_timestamp()::text as now`,
    );
    return new Date(result.rows[0].now);
  }
  private async mutate<T>(
    c: TenantContext,
    permission: Permission,
    requestId: string,
    action: string,
    entityType: string,
    operation: (
      tx: Tx,
      now: Date,
    ) => Promise<{ value: T; id: string; fields: string[] }>,
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
        const result = await operation(tx, await this.now(tx));
        await tx.insert(auditLogs).values({
          businessId: c.businessId,
          actorUserId: c.userId,
          action,
          entityType,
          entityId: result.id,
          metadata: { requestId, fields: result.fields },
        });
        return result.value;
      });
    } catch (error) {
      return translateRentalConflict(error);
    }
  }
  private async getCustomer(db: Reader, c: TenantContext, id: string) {
    const [row] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.businessId, c.businessId), eq(customers.id, id)));
    if (!row) throw missing('CUSTOMER_NOT_FOUND', 'Customer not found');
    return row;
  }
  private async getVehicle(db: Reader, c: TenantContext, id: string) {
    const [row] = await db
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.businessId, c.businessId), eq(vehicles.id, id)));
    if (!row) throw missing('VEHICLE_NOT_FOUND', 'Vehicle not found');
    return row;
  }
  async customer(c: TenantContext, id: string) {
    return this.getCustomer(this.database.db, c, id);
  }
  async listCustomers(c: TenantContext, q: CustomerQuery) {
    const term = q.search ? searchPattern(q.search) : undefined;
    const where = and(
      eq(customers.businessId, c.businessId),
      q.status ? eq(customers.status, q.status) : undefined,
      term
        ? or(
            ilike(customers.name, term),
            ilike(customers.phone, term),
            ilike(customers.email, term),
          )
        : undefined,
    );
    const order = q.order === 'asc' ? asc : desc;
    const [data, totals] = await Promise.all([
      this.database.db
        .select()
        .from(customers)
        .where(where)
        .orderBy(order(customers[q.sort]), order(customers.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db.select({ total: count() }).from(customers).where(where),
    ]);
    return { data, page: q.page, limit: q.limit, total: totals[0].total };
  }
  private contact(phone: string | undefined, email: string | undefined) {
    if (!phone && !email)
      throw new BadRequestException({
        code: 'CUSTOMER_CONTACT_REQUIRED',
        message: 'At least one phone number or email address is required',
      });
  }
  async createCustomer(
    c: TenantContext,
    body: CustomerCreate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'customer.manage',
      requestId,
      'customer.create',
      'customer',
      async (tx) => {
        this.contact(body.phone, body.email);
        const [value] = await tx
          .insert(customers)
          .values({
            businessId: c.businessId,
            name: body.name,
            phone: body.phone,
            email: body.email,
            notes: body.notes,
            status: body.status,
          })
          .returning();
        return { value, id: value.id, fields: changedFields(body) };
      },
    );
  }
  async updateCustomer(
    c: TenantContext,
    id: string,
    body: CustomerUpdate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'customer.manage',
      requestId,
      'customer.update',
      'customer',
      async (tx, now) => {
        const before = await this.getCustomer(tx, c, id);
        this.contact(body.phone ?? before.phone, body.email ?? before.email);
        if (body.status === 'INACTIVE') {
          const [blocking] = await tx
            .select({ id: rentals.id })
            .from(rentals)
            .where(
              and(
                eq(rentals.businessId, c.businessId),
                eq(rentals.customerId, id),
                inArray(rentals.status, ['RESERVED', 'ACTIVE']),
              ),
            )
            .limit(1);
          if (blocking)
            throw rentalConflict(
              'RESOURCE_HAS_RENTAL',
              'Cancel or complete blocking rentals before deactivating this customer',
            );
        }
        const [value] = await tx
          .update(customers)
          .set({
            name: body.name,
            phone: body.phone,
            email: body.email,
            notes: body.notes,
            status: body.status,
            updatedAt: now,
          })
          .where(
            and(eq(customers.businessId, c.businessId), eq(customers.id, id)),
          )
          .returning();
        return { value, id, fields: changedFields(body) };
      },
    );
  }
  private rentalQuery(db: Reader, c: TenantContext) {
    return db
      .select({ rental: rentals, customer: customers, vehicle: vehicles })
      .from(rentals)
      .innerJoin(
        customers,
        and(
          eq(customers.id, rentals.customerId),
          eq(customers.businessId, c.businessId),
        ),
      )
      .innerJoin(
        vehicles,
        and(
          eq(vehicles.id, rentals.vehicleId),
          eq(vehicles.businessId, c.businessId),
        ),
      );
  }
  private present(
    row: {
      rental: typeof rentals.$inferSelect;
      customer: typeof customers.$inferSelect;
      vehicle: typeof vehicles.$inferSelect;
    },
    now: Date,
  ) {
    return {
      ...row.rental,
      rentalAmount: Number(row.rental.rentalAmount),
      depositRequiredAmount: Number(row.rental.depositRequiredAmount),
      customer: row.customer,
      vehicle: row.vehicle,
      isOverdue: isOverdue(row.rental, now),
    };
  }
  private async getRental(db: Reader, c: TenantContext, id: string, now: Date) {
    const [row] = await this.rentalQuery(db, c).where(
      and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)),
    );
    if (!row) throw missing('RENTAL_NOT_FOUND', 'Rental not found');
    return this.present(row, now);
  }
  async rental(c: TenantContext, id: string) {
    return this.getRental(
      this.database.db,
      c,
      id,
      await this.now(this.database.db),
    );
  }
  async listRentals(c: TenantContext, q: RentalQuery) {
    const now = await this.now(this.database.db);
    const term = q.search ? searchPattern(q.search) : undefined;
    const overdue = and(eq(rentals.status, 'ACTIVE'), lte(rentals.endAt, now));
    const where = and(
      eq(rentals.businessId, c.businessId),
      q.status ? eq(rentals.status, q.status) : undefined,
      q.customerId ? eq(rentals.customerId, q.customerId) : undefined,
      q.vehicleId ? eq(rentals.vehicleId, q.vehicleId) : undefined,
      q.overdue === undefined ? undefined : q.overdue ? overdue : not(overdue!),
      term
        ? or(
            ilike(customers.name, term),
            ilike(customers.phone, term),
            ilike(customers.email, term),
            ilike(vehicles.licensePlate, term),
            ilike(sql`${rentals.id}::text`, term),
          )
        : undefined,
    );
    const order = q.order === 'asc' ? asc : desc;
    const [rows, totals] = await Promise.all([
      this.rentalQuery(this.database.db, c)
        .where(where)
        .orderBy(order(rentals[q.sort]), order(rentals.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db
        .select({ total: count() })
        .from(rentals)
        .innerJoin(
          customers,
          and(
            eq(customers.id, rentals.customerId),
            eq(customers.businessId, c.businessId),
          ),
        )
        .innerJoin(
          vehicles,
          and(
            eq(vehicles.id, rentals.vehicleId),
            eq(vehicles.businessId, c.businessId),
          ),
        )
        .where(where),
    ]);
    return {
      data: rows.map((row) => this.present(row, now)),
      page: q.page,
      limit: q.limit,
      total: totals[0].total,
    };
  }
  private async activeResources(
    tx: Tx,
    c: TenantContext,
    customerId: string,
    vehicleId: string,
  ) {
    const customer = await this.getCustomer(tx, c, customerId);
    const vehicle = await this.getVehicle(tx, c, vehicleId);
    if (customer.status !== 'ACTIVE')
      throw rentalConflict('CUSTOMER_INACTIVE', 'Customer must be active');
    if (vehicle.status !== 'ACTIVE')
      throw rentalConflict('VEHICLE_INACTIVE', 'Vehicle must be active');
  }
  async createRental(c: TenantContext, body: RentalCreate, requestId: string) {
    return this.mutate(
      c,
      'rental.manage',
      requestId,
      'rental.create',
      'rental',
      async (tx, now) => {
        const window = rentalWindow(body.startAt, body.endAt);
        await this.activeResources(tx, c, body.customerId, body.vehicleId);
        const [row] = await tx
          .insert(rentals)
          .values({
            businessId: c.businessId,
            customerId: body.customerId,
            vehicleId: body.vehicleId,
            ...window,
            rentalAmount: money(body.rentalAmount),
            depositRequiredAmount: money(body.depositRequiredAmount),
            depositReceived: body.depositReceived,
            notes: body.notes,
          })
          .returning();
        return {
          value: await this.getRental(tx, c, row.id, now),
          id: row.id,
          fields: changedFields(body),
        };
      },
    );
  }
  async updateRental(
    c: TenantContext,
    id: string,
    body: RentalUpdate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'rental.manage',
      requestId,
      'rental.update',
      'rental',
      async (tx, now) => {
        const before = await this.getRental(tx, c, id, now);
        requireRentalStatus(before.status, ['DRAFT', 'RESERVED', 'ACTIVE']);
        const bookingFields = ['customerId', 'vehicleId', 'startAt', 'endAt'];
        if (
          before.status !== 'DRAFT' &&
          changedFields(body).some((field) => bookingFields.includes(field))
        )
          throw rentalConflict(
            'RENTAL_FIELDS_LOCKED',
            'Only draft rentals may change customer, vehicle or dates; use extend to move a blocking end time',
          );
        const window = rentalWindow(
          body.startAt ?? before.startAt,
          body.endAt ?? before.endAt,
        );
        if (before.status === 'DRAFT')
          await this.activeResources(
            tx,
            c,
            body.customerId ?? before.customerId,
            body.vehicleId ?? before.vehicleId,
          );
        await tx
          .update(rentals)
          .set({
            customerId: body.customerId,
            vehicleId: body.vehicleId,
            startAt: body.startAt === undefined ? undefined : window.startAt,
            endAt: body.endAt === undefined ? undefined : window.endAt,
            rentalAmount: money(body.rentalAmount),
            depositRequiredAmount: money(body.depositRequiredAmount),
            depositReceived: body.depositReceived,
            notes: body.notes,
            updatedAt: now,
          })
          .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
        return {
          value: await this.getRental(tx, c, id, now),
          id,
          fields: changedFields(body),
        };
      },
    );
  }
  private blockerWhere(
    c: TenantContext,
    vehicleId: string | typeof vehicles.id,
    startAt: Date,
    endAt: Date,
    now: Date,
    excludeId?: string,
  ) {
    return and(
      eq(rentals.businessId, c.businessId),
      eq(rentals.vehicleId, vehicleId),
      excludeId ? ne(rentals.id, excludeId) : undefined,
      inArray(rentals.status, ['RESERVED', 'ACTIVE']),
      lt(rentals.startAt, endAt),
      or(
        gt(rentals.endAt, startAt),
        and(eq(rentals.status, 'ACTIVE'), lte(rentals.endAt, now)),
      ),
    );
  }
  private async checkConflict(
    tx: Tx,
    c: TenantContext,
    rental: { id: string; vehicleId: string; startAt: Date; endAt: Date },
    now: Date,
  ) {
    const [other] = await tx
      .select({ id: rentals.id })
      .from(rentals)
      .where(
        this.blockerWhere(
          c,
          rental.vehicleId,
          rental.startAt,
          rental.endAt,
          now,
          rental.id,
        ),
      )
      .limit(1);
    if (other)
      throw rentalConflict(
        'RENTAL_CONFLICT',
        'Vehicle has another reservation or active rental during this period',
      );
  }
  async reserve(c: TenantContext, id: string, requestId: string) {
    return this.mutate(
      c,
      'rental.manage',
      requestId,
      'rental.reserve',
      'rental',
      async (tx, now) => {
        const before = await this.getRental(tx, c, id, now);
        requireRentalStatus(before.status, ['DRAFT']);
        if (before.endAt <= now)
          throw rentalConflict(
            'RENTAL_EXPIRED',
            'An expired rental period cannot be reserved',
          );
        await this.activeResources(tx, c, before.customerId, before.vehicleId);
        await this.checkConflict(tx, c, before, now);
        await tx
          .update(rentals)
          .set({ status: 'RESERVED', reservedAt: now, updatedAt: now })
          .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
        return {
          value: await this.getRental(tx, c, id, now),
          id,
          fields: ['status', 'reservedAt'],
        };
      },
    );
  }
  async handover(
    c: TenantContext,
    id: string,
    body: RentalHandover,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'rental.manage',
      requestId,
      'rental.handover',
      'rental',
      async (tx, now) => {
        const before = await this.getRental(tx, c, id, now);
        requireRentalStatus(before.status, ['RESERVED']);
        if (before.startAt > now)
          throw rentalConflict(
            'RENTAL_NOT_STARTED',
            'Handover is available once the rental period begins',
          );
        if (before.endAt <= now)
          throw rentalConflict(
            'RENTAL_EXPIRED',
            'Extend the rental period before handover',
          );
        await this.activeResources(tx, c, before.customerId, before.vehicleId);
        const [active] = await tx
          .select({ id: rentals.id })
          .from(rentals)
          .where(
            and(
              eq(rentals.businessId, c.businessId),
              eq(rentals.vehicleId, before.vehicleId),
              eq(rentals.status, 'ACTIVE'),
              ne(rentals.id, id),
            ),
          )
          .limit(1);
        if (active)
          throw rentalConflict(
            'VEHICLE_RENTED',
            'Vehicle already has an active rental',
          );
        await this.checkConflict(tx, c, before, now);
        const timestamp = new Date(
          Math.max(now.getTime(), before.reservedAt?.getTime() ?? 0),
        );
        await tx
          .update(rentals)
          .set({
            status: 'ACTIVE',
            handedOverAt: timestamp,
            odometerStart: body.odometerStart,
            updatedAt: timestamp,
          })
          .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
        return {
          value: await this.getRental(tx, c, id, now),
          id,
          fields: ['status', 'handedOverAt', 'odometerStart'],
        };
      },
    );
  }
  async extend(
    c: TenantContext,
    id: string,
    body: RentalExtend,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'rental.manage',
      requestId,
      'rental.extend',
      'rental',
      async (tx, now) => {
        const before = await this.getRental(tx, c, id, now);
        requireRentalStatus(before.status, ['RESERVED', 'ACTIVE']);
        const { endAt } = rentalWindow(before.startAt, body.endAt);
        if (endAt <= before.endAt || endAt <= now)
          throw new BadRequestException({
            code: 'INVALID_EXTENSION',
            message:
              'The new end must be later than the existing end and current time',
          });
        await this.checkConflict(tx, c, { ...before, endAt }, now);
        await tx
          .update(rentals)
          .set({
            endAt,
            rentalAmount: money(body.rentalAmount),
            updatedAt: now,
          })
          .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
        return {
          value: await this.getRental(tx, c, id, now),
          id,
          fields: changedFields(body),
        };
      },
    );
  }
  async returnRental(
    c: TenantContext,
    id: string,
    body: RentalReturn,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'rental.manage',
      requestId,
      'rental.return',
      'rental',
      async (tx, now) => {
        const before = await this.getRental(tx, c, id, now);
        requireRentalStatus(before.status, ['ACTIVE']);
        if (body.odometerEnd < (before.odometerStart ?? 0))
          throw new BadRequestException({
            code: 'INVALID_ODOMETER',
            message: 'Return odometer must not be less than handover odometer',
          });
        const timestamp = new Date(
          Math.max(now.getTime(), before.handedOverAt?.getTime() ?? 0),
        );
        await tx
          .update(rentals)
          .set({
            status: 'COMPLETED',
            returnedAt: timestamp,
            odometerEnd: body.odometerEnd,
            updatedAt: timestamp,
          })
          .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
        return {
          value: await this.getRental(tx, c, id, now),
          id,
          fields: ['status', 'returnedAt', 'odometerEnd'],
        };
      },
    );
  }
  async cancel(
    c: TenantContext,
    id: string,
    body: RentalCancel,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'rental.manage',
      requestId,
      'rental.cancel',
      'rental',
      async (tx, now) => {
        const before = await this.getRental(tx, c, id, now);
        requireRentalStatus(before.status, ['DRAFT', 'RESERVED']);
        const timestamp = new Date(
          Math.max(now.getTime(), before.reservedAt?.getTime() ?? 0),
        );
        await tx
          .update(rentals)
          .set({
            status: 'CANCELLED',
            cancelledAt: timestamp,
            notes: body.notes,
            updatedAt: timestamp,
          })
          .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
        return {
          value: await this.getRental(tx, c, id, now),
          id,
          fields: ['status', 'cancelledAt', ...changedFields(body)],
        };
      },
    );
  }
  async availability(c: TenantContext, q: VehicleAvailabilityQuery) {
    const { startAt, endAt } = rentalWindow(q.startAt, q.endAt);
    const now = await this.now(this.database.db);
    const term = q.search ? searchPattern(q.search) : undefined;
    const blockers = this.database.db
      .select({ one: sql`1` })
      .from(rentals)
      .where(this.blockerWhere(c, vehicles.id, startAt, endAt, now));
    const active = this.database.db
      .select({ one: sql`1` })
      .from(rentals)
      .where(
        and(
          this.blockerWhere(c, vehicles.id, startAt, endAt, now),
          eq(rentals.status, 'ACTIVE'),
        ),
      );
    const overdue = this.database.db
      .select({ one: sql`1` })
      .from(rentals)
      .where(
        and(
          this.blockerWhere(c, vehicles.id, startAt, endAt, now),
          eq(rentals.status, 'ACTIVE'),
          lte(rentals.endAt, now),
        ),
      );
    const where = and(
      eq(vehicles.businessId, c.businessId),
      q.branchId ? eq(vehicles.branchId, q.branchId) : undefined,
      term
        ? or(
            ilike(vehicles.licensePlate, term),
            ilike(vehicles.make, term),
            ilike(vehicles.model, term),
          )
        : undefined,
      q.availableOnly
        ? and(eq(vehicles.status, 'ACTIVE'), notExists(blockers))
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      this.database.db
        .select({
          vehicle: vehicles,
          blocked: exists(blockers),
          active: exists(active),
          overdue: exists(overdue),
        })
        .from(vehicles)
        .where(where)
        .orderBy(asc(vehicles.licensePlate), asc(vehicles.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db.select({ total: count() }).from(vehicles).where(where),
    ]);
    return {
      data: rows.map((row) => ({
        ...row.vehicle,
        available: row.vehicle.status === 'ACTIVE' && !row.blocked,
        reason:
          row.vehicle.status !== 'ACTIVE'
            ? 'INACTIVE'
            : row.overdue
              ? 'OVERDUE'
              : row.active
                ? 'RENTED'
                : row.blocked
                  ? 'RESERVED'
                  : null,
      })),
      page: q.page,
      limit: q.limit,
      total: totals[0].total,
    };
  }
  async vehicleRentalState(c: TenantContext, vehicleId: string) {
    const now = await this.now(this.database.db);
    const vehicle = await this.getVehicle(this.database.db, c, vehicleId);
    const [active] = await this.rentalQuery(this.database.db, c)
      .where(
        and(
          eq(rentals.businessId, c.businessId),
          eq(rentals.vehicleId, vehicleId),
          eq(rentals.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    const [current] = active
      ? []
      : await this.rentalQuery(this.database.db, c)
          .where(
            and(
              eq(rentals.businessId, c.businessId),
              eq(rentals.vehicleId, vehicleId),
              eq(rentals.status, 'RESERVED'),
              lte(rentals.startAt, now),
              gt(rentals.endAt, now),
            ),
          )
          .orderBy(asc(rentals.startAt), asc(rentals.id))
          .limit(1);
    const [next] = await this.rentalQuery(this.database.db, c)
      .where(
        and(
          eq(rentals.businessId, c.businessId),
          eq(rentals.vehicleId, vehicleId),
          eq(rentals.status, 'RESERVED'),
          gt(rentals.startAt, now),
        ),
      )
      .orderBy(asc(rentals.startAt), asc(rentals.id))
      .limit(1);
    const selected = active ?? current;
    return {
      vehicleId,
      state:
        vehicle.status !== 'ACTIVE'
          ? 'INACTIVE'
          : active
            ? isOverdue(active.rental, now)
              ? 'OVERDUE'
              : 'RENTED'
            : current
              ? 'RESERVED'
              : 'AVAILABLE',
      currentRental: selected ? this.present(selected, now) : null,
      nextRental: next ? this.present(next, now) : null,
    };
  }
}
