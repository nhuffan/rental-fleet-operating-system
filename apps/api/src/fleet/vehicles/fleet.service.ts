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
  desc,
  eq,
  ilike,
  isNull,
  inArray,
  notExists,
  or,
  sql,
} from 'drizzle-orm';
import { Database } from '../../database/database.js';
import {
  auditLogs,
  branches,
  businesses,
  deviceAssignments,
  gpsDevices,
  memberships,
  profiles,
  rentals,
  vehicles,
  vehicleServiceRecords,
} from '../../database/schema.js';
import { denied, type TenantContext } from '../../auth/guards.js';
import { permissionsFor, type Permission } from '../../auth/permissions.js';
import { PageQuery } from '../../core/dto.js';
import {
  DeviceAssignmentCreate,
  GpsDeviceCreate,
  GpsDeviceQuery,
  GpsDeviceUpdate,
  VehicleCreate,
  VehicleQuery,
  VehicleUpdate,
  ServiceRecordCreate,
} from './dto.js';
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Reader = Database['db'] | Tx;
const conflict = (code: string, message: string) =>
  new ConflictException({ code, message });
const missing = (code: string, message: string) =>
  new NotFoundException({ code, message });
const changedFields = (body: object) =>
  Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
const searchPattern = (value: string) =>
  `%${value.replace(/[\\%_]/g, '\\$&')}%`;

/** PostgreSQL errors may be wrapped by Drizzle; never return raw database details. */
export function translateFleetConflict(error: unknown): never {
  let current: unknown = error;
  const visited = new Set<unknown>();
  while (
    typeof current === 'object' &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    const detail = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (detail.code === '23505') {
      const names: Record<string, [string, string]> = {
        vehicles_business_plate_unique: [
          'PLATE_EXISTS',
          'License plate already exists in this business',
        ],
        gps_devices_provider_uid_unique: [
          'DEVICE_UID_EXISTS',
          'Provider and device UID already exist',
        ],
        device_assignments_active_vehicle_unique: [
          'VEHICLE_ASSIGNED',
          'Vehicle already has an active device assignment',
        ],
        device_assignments_active_device_unique: [
          'DEVICE_ASSIGNED',
          'Device already has an active vehicle assignment',
        ],
      };
      const match = names[detail.constraint ?? ''];
      if (match) throw conflict(...match);
    }
    current = detail.cause;
  }
  throw error;
}
@Injectable()
export class FleetService {
  constructor(@Inject(Database) private readonly database: Database) {}
  private async mutate<T>(
    c: TenantContext,
    permission: Permission,
    requestId: string,
    action: string,
    entityType: string,
    operation: (tx: Tx) => Promise<{ value: T; id: string; fields: string[] }>,
  ) {
    try {
      return await this.database.db.transaction(async (tx) => {
        // Same tenant lock as SaaS Core: serialize writes and recheck current authorization after waiting.
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
        const result = await operation(tx);
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
      return translateFleetConflict(error);
    }
  }
  private vehicleQuery(db: Reader, c: TenantContext) {
    return db
      .select({
        vehicle: vehicles,
        assignment: deviceAssignments,
        device: gpsDevices,
      })
      .from(vehicles)
      .leftJoin(
        deviceAssignments,
        and(
          eq(deviceAssignments.vehicleId, vehicles.id),
          eq(deviceAssignments.businessId, c.businessId),
          isNull(deviceAssignments.unassignedAt),
        ),
      )
      .leftJoin(
        gpsDevices,
        and(
          eq(gpsDevices.id, deviceAssignments.deviceId),
          eq(gpsDevices.businessId, c.businessId),
        ),
      );
  }
  private async getVehicle(db: Reader, c: TenantContext, id: string) {
    const [row] = await this.vehicleQuery(db, c).where(
      and(eq(vehicles.id, id), eq(vehicles.businessId, c.businessId)),
    );
    if (!row) throw missing('VEHICLE_NOT_FOUND', 'Vehicle not found');
    return {
      ...row.vehicle,
      currentAssignment:
        row.assignment && row.device
          ? { ...row.assignment, device: row.device }
          : null,
    };
  }
  async vehicle(c: TenantContext, id: string) {
    return this.getVehicle(this.database.db, c, id);
  }
  async listVehicles(c: TenantContext, q: VehicleQuery) {
    const term = q.search ? searchPattern(q.search) : undefined;
    const where = and(
      eq(vehicles.businessId, c.businessId),
      q.status ? eq(vehicles.status, q.status) : undefined,
      q.branchId ? eq(vehicles.branchId, q.branchId) : undefined,
      term
        ? or(
            ilike(vehicles.licensePlate, term),
            ilike(vehicles.make, term),
            ilike(vehicles.model, term),
          )
        : undefined,
    );
    const order = q.order === 'asc' ? asc : desc;
    const [rows, totals] = await Promise.all([
      this.vehicleQuery(this.database.db, c)
        .where(where)
        .orderBy(order(vehicles[q.sort]), order(vehicles.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db.select({ total: count() }).from(vehicles).where(where),
    ]);
    return {
      data: rows.map((row) => ({
        ...row.vehicle,
        currentAssignment:
          row.assignment && row.device
            ? { ...row.assignment, device: row.device }
            : null,
      })),
      page: q.page,
      limit: q.limit,
      total: totals[0].total,
    };
  }
  private async validateBranch(
    tx: Tx,
    c: TenantContext,
    id: string | null | undefined,
  ) {
    if (!id) return;
    const [branch] = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.id, id),
          eq(branches.businessId, c.businessId),
          eq(branches.status, 'ACTIVE'),
        ),
      );
    if (!branch)
      throw new BadRequestException({
        code: 'INVALID_BRANCH',
        message: 'Branch must be active and belong to this business',
      });
  }
  async createVehicle(
    c: TenantContext,
    body: VehicleCreate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'vehicle.manage',
      requestId,
      'vehicle.create',
      'vehicle',
      async (tx) => {
        await this.validateBranch(tx, c, body.branchId);
        const [value] = await tx
          .insert(vehicles)
          .values({
            businessId: c.businessId,
            branchId: body.branchId,
            licensePlate: body.licensePlate,
            make: body.make,
            model: body.model,
            status: body.status,
            registrationExpiresOn: body.registrationExpiresOn,
            insuranceExpiresOn: body.insuranceExpiresOn,
            nextMaintenanceOn: body.nextMaintenanceOn,
            nextMaintenanceOdometer: body.nextMaintenanceOdometer,
          })
          .returning();
        return {
          value: { ...value, currentAssignment: null },
          id: value.id,
          fields: changedFields(body),
        };
      },
    );
  }
  async updateVehicle(
    c: TenantContext,
    id: string,
    body: VehicleUpdate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'vehicle.manage',
      requestId,
      'vehicle.update',
      'vehicle',
      async (tx) => {
        const before = await this.getVehicle(tx, c, id);
        if (body.branchId !== undefined && body.branchId !== before.branchId)
          await this.validateBranch(tx, c, body.branchId);
        if (body.status === 'INACTIVE' && before.currentAssignment)
          throw conflict(
            'RESOURCE_HAS_ASSIGNMENT',
            'End the active assignment before deactivating this vehicle',
          );
        if (body.status === 'INACTIVE') {
          const [blocking] = await tx
            .select({ id: rentals.id })
            .from(rentals)
            .where(
              and(
                eq(rentals.businessId, c.businessId),
                eq(rentals.vehicleId, id),
                inArray(rentals.status, ['RESERVED', 'ACTIVE']),
              ),
            )
            .limit(1);
          if (blocking)
            throw conflict(
              'RESOURCE_HAS_RENTAL',
              'Cancel or complete blocking rentals before deactivating this vehicle',
            );
        }
        await tx
          .update(vehicles)
          .set({
            licensePlate: body.licensePlate,
            make: body.make,
            model: body.model,
            branchId: body.branchId,
            status: body.status,
            registrationExpiresOn: body.registrationExpiresOn,
            insuranceExpiresOn: body.insuranceExpiresOn,
            nextMaintenanceOn: body.nextMaintenanceOn,
            nextMaintenanceOdometer: body.nextMaintenanceOdometer,
            updatedAt: new Date(),
          })
          .where(
            and(eq(vehicles.id, id), eq(vehicles.businessId, c.businessId)),
          );
        return {
          value: await this.getVehicle(tx, c, id),
          id,
          fields: changedFields(body),
        };
      },
    );
  }
  async listServiceRecords(c: TenantContext, id: string, q: PageQuery) {
    await this.getVehicle(this.database.db, c, id);
    const where = and(
      eq(vehicleServiceRecords.businessId, c.businessId),
      eq(vehicleServiceRecords.vehicleId, id),
    );
    const [data, [totals]] = await Promise.all([
      this.database.db
        .select()
        .from(vehicleServiceRecords)
        .where(where)
        .orderBy(
          desc(vehicleServiceRecords.performedOn),
          desc(vehicleServiceRecords.id),
        )
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db
        .select({ total: count() })
        .from(vehicleServiceRecords)
        .where(where),
    ]);
    return { data, page: q.page, limit: q.limit, total: totals.total };
  }
  async createServiceRecord(
    c: TenantContext,
    id: string,
    body: ServiceRecordCreate,
    requestId: string,
  ) {
    if (body.nextDueOdometer !== undefined && body.kind !== 'MAINTENANCE')
      throw new BadRequestException({
        code: 'SERVICE_NEXT_ODOMETER_INVALID',
        message: 'nextDueOdometer applies to maintenance only',
      });
    return this.mutate(
      c,
      'vehicle.manage',
      requestId,
      'vehicle_service.create',
      'vehicle_service_record',
      async (tx) => {
        await this.getVehicle(tx, c, id);
        const today = await tx.execute<{ today: string }>(
          sql`select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text as today`,
        );
        if (body.performedOn > today.rows[0].today)
          throw new BadRequestException({
            code: 'SERVICE_DATE_FUTURE',
            message: 'performedOn cannot be in the future',
          });
        const [value] = await tx
          .insert(vehicleServiceRecords)
          .values({
            businessId: c.businessId,
            vehicleId: id,
            kind: body.kind,
            performedOn: body.performedOn,
            odometer: body.odometer,
            costVnd: body.costVnd,
            notes: body.notes ?? '',
            createdBy: c.userId,
          })
          .returning();
        const next =
          body.kind === 'MAINTENANCE'
            ? {
                nextMaintenanceOn: body.nextDueOn,
                nextMaintenanceOdometer: body.nextDueOdometer,
              }
            : body.kind === 'REGISTRATION'
              ? { registrationExpiresOn: body.nextDueOn }
              : { insuranceExpiresOn: body.nextDueOn };
        if (Object.values(next).some((v) => v !== undefined))
          await tx
            .update(vehicles)
            .set({ ...next, updatedAt: new Date() })
            .where(
              and(eq(vehicles.id, id), eq(vehicles.businessId, c.businessId)),
            );
        return { value, id: value.id, fields: changedFields(body) };
      },
    );
  }
  private async getDevice(db: Reader, c: TenantContext, id: string) {
    const [row] = await db
      .select()
      .from(gpsDevices)
      .where(
        and(eq(gpsDevices.id, id), eq(gpsDevices.businessId, c.businessId)),
      );
    if (!row) throw missing('DEVICE_NOT_FOUND', 'GPS device not found');
    return row;
  }
  async listDevices(c: TenantContext, q: GpsDeviceQuery) {
    const term = q.search ? searchPattern(q.search) : undefined;
    const where = and(
      eq(gpsDevices.businessId, c.businessId),
      q.status ? eq(gpsDevices.status, q.status) : undefined,
      q.provider ? eq(gpsDevices.provider, q.provider) : undefined,
      term
        ? or(
            ilike(gpsDevices.deviceUid, term),
            ilike(gpsDevices.label, term),
            ilike(gpsDevices.provider, term),
          )
        : undefined,
      q.available
        ? notExists(
            this.database.db
              .select({ one: sql`1` })
              .from(deviceAssignments)
              .where(
                and(
                  eq(deviceAssignments.deviceId, gpsDevices.id),
                  eq(deviceAssignments.businessId, c.businessId),
                  isNull(deviceAssignments.unassignedAt),
                ),
              ),
          )
        : undefined,
    );
    const order = q.order === 'asc' ? asc : desc;
    const [data, totals] = await Promise.all([
      this.database.db
        .select()
        .from(gpsDevices)
        .where(where)
        .orderBy(order(gpsDevices[q.sort]), order(gpsDevices.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db.select({ total: count() }).from(gpsDevices).where(where),
    ]);
    return { data, page: q.page, limit: q.limit, total: totals[0].total };
  }
  async createDevice(
    c: TenantContext,
    body: GpsDeviceCreate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'gps.manage',
      requestId,
      'gps_device.create',
      'gps_device',
      async (tx) => {
        const [value] = await tx
          .insert(gpsDevices)
          .values({
            businessId: c.businessId,
            provider: body.provider,
            deviceUid: body.deviceUid,
            label: body.label,
            status: body.status,
          })
          .returning();
        return { value, id: value.id, fields: changedFields(body) };
      },
    );
  }
  async updateDevice(
    c: TenantContext,
    id: string,
    body: GpsDeviceUpdate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'gps.manage',
      requestId,
      'gps_device.update',
      'gps_device',
      async (tx) => {
        await this.getDevice(tx, c, id);
        if (body.status === 'INACTIVE') {
          const active = await this.activeAssignment(tx, c, 'deviceId', id);
          if (active)
            throw conflict(
              'RESOURCE_HAS_ASSIGNMENT',
              'End the active assignment before deactivating this device',
            );
        }
        const [value] = await tx
          .update(gpsDevices)
          .set({
            label: body.label,
            status: body.status,
            updatedAt: new Date(),
          })
          .where(
            and(eq(gpsDevices.id, id), eq(gpsDevices.businessId, c.businessId)),
          )
          .returning();
        return { value, id, fields: changedFields(body) };
      },
    );
  }
  private async activeAssignment(
    tx: Tx,
    c: TenantContext,
    column: 'vehicleId' | 'deviceId',
    id: string,
  ) {
    const [row] = await tx
      .select()
      .from(deviceAssignments)
      .where(
        and(
          eq(deviceAssignments.businessId, c.businessId),
          eq(deviceAssignments[column], id),
          isNull(deviceAssignments.unassignedAt),
        ),
      )
      .limit(1);
    return row;
  }
  async listAssignments(c: TenantContext, vehicleId: string, q: PageQuery) {
    await this.getVehicle(this.database.db, c, vehicleId);
    const where = and(
      eq(deviceAssignments.businessId, c.businessId),
      eq(deviceAssignments.vehicleId, vehicleId),
    );
    const [rows, totals] = await Promise.all([
      this.database.db
        .select({ assignment: deviceAssignments, device: gpsDevices })
        .from(deviceAssignments)
        .innerJoin(
          gpsDevices,
          and(
            eq(gpsDevices.id, deviceAssignments.deviceId),
            eq(gpsDevices.businessId, c.businessId),
          ),
        )
        .where(where)
        .orderBy(desc(deviceAssignments.assignedAt), desc(deviceAssignments.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db
        .select({ total: count() })
        .from(deviceAssignments)
        .where(where),
    ]);
    return {
      data: rows.map((row) => ({ ...row.assignment, device: row.device })),
      page: q.page,
      limit: q.limit,
      total: totals[0].total,
    };
  }
  async assignDevice(
    c: TenantContext,
    vehicleId: string,
    body: DeviceAssignmentCreate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'vehicle.manage',
      requestId,
      'device_assignment.assign',
      'device_assignment',
      async (tx) => {
        const vehicle = await this.getVehicle(tx, c, vehicleId);
        const device = await this.getDevice(tx, c, body.deviceId);
        if (vehicle.status !== 'ACTIVE')
          throw conflict(
            'VEHICLE_INACTIVE',
            'Only active vehicles can receive a device',
          );
        if (device.status !== 'ACTIVE')
          throw conflict(
            'DEVICE_INACTIVE',
            'Only active devices can be assigned',
          );
        if (vehicle.currentAssignment)
          throw conflict(
            'VEHICLE_ASSIGNED',
            'Vehicle already has an active device assignment',
          );
        if (await this.activeAssignment(tx, c, 'deviceId', device.id))
          throw conflict(
            'DEVICE_ASSIGNED',
            'Device already has an active vehicle assignment',
          );
        const [assignment] = await tx
          .insert(deviceAssignments)
          .values({
            businessId: c.businessId,
            vehicleId,
            deviceId: device.id,
            assignedAt: sql`clock_timestamp()`,
          })
          .returning();
        return {
          value: { ...assignment, device },
          id: assignment.id,
          fields: ['vehicleId', 'deviceId'],
        };
      },
    );
  }
  async endAssignment(
    c: TenantContext,
    vehicleId: string,
    assignmentId: string,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'vehicle.manage',
      requestId,
      'device_assignment.end',
      'device_assignment',
      async (tx) => {
        await this.getVehicle(tx, c, vehicleId);
        const [before] = await tx
          .select()
          .from(deviceAssignments)
          .where(
            and(
              eq(deviceAssignments.id, assignmentId),
              eq(deviceAssignments.businessId, c.businessId),
              eq(deviceAssignments.vehicleId, vehicleId),
            ),
          );
        if (!before)
          throw missing('ASSIGNMENT_NOT_FOUND', 'Device assignment not found');
        if (before.unassignedAt)
          throw conflict(
            'ASSIGNMENT_ENDED',
            'Device assignment has already ended',
          );
        const [assignment] = await tx
          .update(deviceAssignments)
          .set({
            unassignedAt: sql`greatest(clock_timestamp(), ${deviceAssignments.assignedAt})`,
          })
          .where(
            and(
              eq(deviceAssignments.id, assignmentId),
              eq(deviceAssignments.businessId, c.businessId),
              eq(deviceAssignments.vehicleId, vehicleId),
              isNull(deviceAssignments.unassignedAt),
            ),
          )
          .returning();
        if (!assignment)
          throw conflict(
            'ASSIGNMENT_ENDED',
            'Device assignment has already ended',
          );
        return {
          value: {
            ...assignment,
            device: await this.getDevice(tx, c, assignment.deviceId),
          },
          id: assignmentId,
          fields: ['unassignedAt'],
        };
      },
    );
  }
}
