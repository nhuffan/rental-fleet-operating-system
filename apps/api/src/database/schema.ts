import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  check,
  unique,
  index,
  uniqueIndex,
  foreignKey,
} from 'drizzle-orm/pg-core';
const times = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const businesses = pgTable('businesses', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  status: text().notNull().default('ACTIVE'),
  timezone: text().notNull().default('Asia/Ho_Chi_Minh'),
  currency: text().notNull().default('VND'),
  ...times(),
});
export const profiles = pgTable('user_profiles', {
  userId: uuid('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  status: text().notNull().default('ACTIVE'),
  ...times(),
});
export const memberships = pgTable('business_memberships', {
  id: uuid().primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.userId),
  roleKey: text('role_key').notNull(),
  status: text().notNull().default('ACTIVE'),
  ...times(),
});
export const branches = pgTable(
  'branches',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text().notNull(),
    address: text().notNull().default(''),
    status: text().notNull().default('ACTIVE'),
    ...times(),
  },
  (table) => [
    unique('branches_business_id_id_unique').on(table.businessId, table.id),
  ],
);
export const settings = pgTable('business_settings', {
  businessId: uuid('business_id')
    .primaryKey()
    .references(() => businesses.id),
  config: jsonb()
    .notNull()
    .$type<{ locale?: string; dateFormat?: string }>()
    .default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const auditLogs = pgTable('audit_logs', {
  id: uuid().primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id),
  actorUserId: uuid('actor_user_id').notNull(),
  action: text().notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb().notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id'),
    licensePlate: text('license_plate').notNull(),
    make: text().notNull(),
    model: text().notNull(),
    status: text().notNull().default('ACTIVE'),
    ...times(),
  },
  (table) => [
    check(
      'vehicles_license_plate_check',
      sql`${table.licensePlate} ~ '^[A-Z0-9]{4,16}$'`,
    ),
    check(
      'vehicles_make_check',
      sql`length(trim(${table.make})) between 1 and 80`,
    ),
    check(
      'vehicles_model_check',
      sql`length(trim(${table.model})) between 1 and 80`,
    ),
    check(
      'vehicles_status_check',
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
    unique('vehicles_business_plate_unique').on(
      table.businessId,
      table.licensePlate,
    ),
    unique('vehicles_business_id_id_unique').on(table.businessId, table.id),
    foreignKey({
      name: 'vehicles_branch_tenant_fk',
      columns: [table.businessId, table.branchId],
      foreignColumns: [branches.businessId, branches.id],
    }).onDelete('restrict'),
    index('vehicles_business_created').on(
      table.businessId,
      table.createdAt.desc(),
      table.id,
    ),
    index('vehicles_business_branch').on(table.businessId, table.branchId),
  ],
);

export const gpsDevices = pgTable(
  'gps_devices',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    provider: text().notNull(),
    deviceUid: text('device_uid').notNull(),
    label: text().notNull().default(''),
    status: text().notNull().default('ACTIVE'),
    ...times(),
  },
  (table) => [
    check(
      'gps_devices_provider_check',
      sql`${table.provider} ~ '^[a-z0-9][a-z0-9_-]{0,39}$'`,
    ),
    check(
      'gps_devices_uid_check',
      sql`${table.deviceUid} ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$'`,
    ),
    check('gps_devices_label_check', sql`length(${table.label}) <= 120`),
    check(
      'gps_devices_status_check',
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
    unique('gps_devices_provider_uid_unique').on(
      table.provider,
      table.deviceUid,
    ),
    unique('gps_devices_business_id_id_unique').on(table.businessId, table.id),
    index('gps_devices_business_created').on(
      table.businessId,
      table.createdAt.desc(),
      table.id,
    ),
  ],
);

export const deviceAssignments = pgTable(
  'device_assignments',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id').notNull(),
    deviceId: uuid('device_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    unassignedAt: timestamp('unassigned_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'device_assignments_vehicle_tenant_fk',
      columns: [table.businessId, table.vehicleId],
      foreignColumns: [vehicles.businessId, vehicles.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'device_assignments_device_tenant_fk',
      columns: [table.businessId, table.deviceId],
      foreignColumns: [gpsDevices.businessId, gpsDevices.id],
    }).onDelete('restrict'),
    check(
      'device_assignments_time_check',
      sql`${table.unassignedAt} is null or ${table.unassignedAt} >= ${table.assignedAt}`,
    ),
    uniqueIndex('device_assignments_active_vehicle_unique')
      .on(table.vehicleId)
      .where(sql`${table.unassignedAt} is null`),
    uniqueIndex('device_assignments_active_device_unique')
      .on(table.deviceId)
      .where(sql`${table.unassignedAt} is null`),
    index('device_assignments_vehicle_history').on(
      table.businessId,
      table.vehicleId,
      table.assignedAt.desc(),
      table.id,
    ),
    index('device_assignments_device_history').on(
      table.businessId,
      table.deviceId,
      table.assignedAt.desc(),
      table.id,
    ),
  ],
);
