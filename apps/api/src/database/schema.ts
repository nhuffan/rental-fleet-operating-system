import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
  doublePrecision,
  boolean,
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
export const memberships = pgTable(
  'business_memberships',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId),
    roleKey: text('role_key').notNull().$type<'OWNER'>(),
    status: text().notNull().default('ACTIVE'),
    ...times(),
  },
  (table) => [
    check(
      'business_memberships_role_key_check',
      sql`${table.roleKey} = 'OWNER'`,
    ),
  ],
);
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

export const customers = pgTable(
  'customers',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    phone: text().notNull().default(''),
    email: text().notNull().default(''),
    notes: text().notNull().default(''),
    status: text().notNull().default('ACTIVE'),
    ...times(),
  },
  (table) => [
    check(
      'customers_name_check',
      sql`${table.name} = trim(${table.name}) and length(${table.name}) between 1 and 120`,
    ),
    check(
      'customers_phone_check',
      sql`${table.phone} = trim(${table.phone}) and length(${table.phone}) <= 32 and (${table.phone} = '' or ${table.phone} ~ '^\\+?[0-9][0-9 -]{4,31}$')`,
    ),
    check(
      'customers_email_check',
      sql`${table.email} = lower(trim(${table.email})) and length(${table.email}) <= 254 and (${table.email} = '' or ${table.email} ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')`,
    ),
    check(
      'customers_contact_check',
      sql`${table.phone} <> '' or ${table.email} <> ''`,
    ),
    check('customers_notes_check', sql`length(${table.notes}) <= 2000`),
    check(
      'customers_status_check',
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
    unique('customers_business_id_id_unique').on(table.businessId, table.id),
    index('customers_business_created').on(
      table.businessId,
      table.createdAt.desc(),
      table.id,
    ),
    index('customers_business_status_name').on(
      table.businessId,
      table.status,
      table.name,
      table.id,
    ),
  ],
);

export const rentals = pgTable(
  'rentals',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: text().notNull().default('DRAFT'),
    rentalAmount: numeric('rental_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    depositRequiredAmount: numeric('deposit_required_amount', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0'),
    depositReceived: boolean('deposit_received').notNull().default(false),
    notes: text().notNull().default(''),
    reservedAt: timestamp('reserved_at', { withTimezone: true }),
    handedOverAt: timestamp('handed_over_at', { withTimezone: true }),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    odometerStart: integer('odometer_start'),
    odometerEnd: integer('odometer_end'),
    ...times(),
  },
  (table) => [
    foreignKey({
      name: 'rentals_customer_tenant_fk',
      columns: [table.businessId, table.customerId],
      foreignColumns: [customers.businessId, customers.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'rentals_vehicle_tenant_fk',
      columns: [table.businessId, table.vehicleId],
      foreignColumns: [vehicles.businessId, vehicles.id],
    }).onDelete('restrict'),
    check(
      'rentals_time_check',
      sql`isfinite(${table.startAt}) and isfinite(${table.endAt}) and ${table.endAt} > ${table.startAt}`,
    ),
    check(
      'rentals_amount_check',
      sql`${table.rentalAmount} >= 0 and ${table.depositRequiredAmount} >= 0 and ${table.rentalAmount} <> 'NaN'::numeric and ${table.depositRequiredAmount} <> 'NaN'::numeric`,
    ),
    check('rentals_notes_check', sql`length(${table.notes}) <= 4000`),
    check(
      'rentals_status_check',
      sql`${table.status} in ('DRAFT', 'RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED')`,
    ),
    check(
      'rentals_odometer_check',
      sql`(${table.odometerStart} is null or ${table.odometerStart} >= 0) and (${table.odometerEnd} is null or ${table.odometerEnd} >= ${table.odometerStart})`,
    ),
    check(
      'rentals_milestone_time_check',
      sql`
      (${table.reservedAt} is null or isfinite(${table.reservedAt})) and
      (${table.handedOverAt} is null or isfinite(${table.handedOverAt})) and
      (${table.returnedAt} is null or isfinite(${table.returnedAt})) and
      (${table.cancelledAt} is null or isfinite(${table.cancelledAt})) and
      (${table.handedOverAt} is null or ${table.handedOverAt} >= ${table.reservedAt}) and
      (${table.returnedAt} is null or ${table.returnedAt} >= ${table.handedOverAt}) and
      (${table.cancelledAt} is null or ${table.reservedAt} is null or ${table.cancelledAt} >= ${table.reservedAt})
    `,
    ),
    check(
      'rentals_state_milestones_check',
      sql`
      (${table.status} = 'DRAFT' and ${table.reservedAt} is null and ${table.handedOverAt} is null and ${table.returnedAt} is null and ${table.cancelledAt} is null and ${table.odometerStart} is null and ${table.odometerEnd} is null) or
      (${table.status} = 'RESERVED' and ${table.reservedAt} is not null and ${table.handedOverAt} is null and ${table.returnedAt} is null and ${table.cancelledAt} is null and ${table.odometerStart} is null and ${table.odometerEnd} is null) or
      (${table.status} = 'ACTIVE' and ${table.reservedAt} is not null and ${table.handedOverAt} is not null and ${table.returnedAt} is null and ${table.cancelledAt} is null and ${table.odometerStart} is not null and ${table.odometerEnd} is null) or
      (${table.status} = 'COMPLETED' and ${table.reservedAt} is not null and ${table.handedOverAt} is not null and ${table.returnedAt} is not null and ${table.cancelledAt} is null and ${table.odometerStart} is not null and ${table.odometerEnd} is not null) or
      (${table.status} = 'CANCELLED' and ${table.handedOverAt} is null and ${table.returnedAt} is null and ${table.cancelledAt} is not null and ${table.odometerStart} is null and ${table.odometerEnd} is null)
    `,
    ),
    // Drizzle has no exclusion-constraint mapping. SQL migration is authoritative for
    // rentals_blocking_vehicle_time_exclusion (btree_gist + half-open tstzrange).
    uniqueIndex('rentals_active_vehicle_unique')
      .on(table.businessId, table.vehicleId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index('rentals_business_created').on(
      table.businessId,
      table.createdAt.desc(),
      table.id,
    ),
    index('rentals_business_status_start').on(
      table.businessId,
      table.status,
      table.startAt,
      table.id,
    ),
    index('rentals_customer_history').on(
      table.businessId,
      table.customerId,
      table.startAt.desc(),
      table.id,
    ),
    index('rentals_vehicle_history').on(
      table.businessId,
      table.vehicleId,
      table.startAt.desc(),
      table.id,
    ),
  ],
);

// SQL migration owns checks, composite assignment FK and index definitions.
export const gpsPositions = pgTable('gps_positions', {
  id: uuid().primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  assignmentId: uuid('assignment_id').notNull(),
  deviceId: uuid('device_id').notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  provider: text().notNull(),
  deviceUid: text('device_uid').notNull(),
  eventKey: text('event_key').notNull(),
  sourceEventId: text('source_event_id'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  speedKph: doublePrecision('speed_kph').notNull(),
  heading: doublePrecision().notNull(),
  ignition: boolean(),
  sourceMode: text('source_mode').notNull().default('TEST'),
});

// Trusted platform authorization is separate from tenant roles. SQL denies all Data API access.
export const platformMemberships = pgTable(
  'platform_memberships',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),
    roleKey: text('role_key').notNull().default('PLATFORM_OPERATOR'),
    status: text().notNull().default('ACTIVE'),
    ...times(),
  },
  (table) => [
    unique('platform_memberships_user_unique').on(table.userId),
    check(
      'platform_memberships_role_check',
      sql`${table.roleKey} = 'PLATFORM_OPERATOR'`,
    ),
    check(
      'platform_memberships_status_check',
      sql`${table.status} in ('ACTIVE', 'DISABLED')`,
    ),
  ],
);

export const platformAuditLogs = pgTable(
  'platform_audit_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').notNull(),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb().notNull().$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'platform_audit_action_check',
      sql`length(trim(${table.action})) between 1 and 80`,
    ),
    check(
      'platform_audit_entity_type_check',
      sql`length(trim(${table.entityType})) between 1 and 80`,
    ),
    check(
      'platform_audit_metadata_check',
      sql`jsonb_typeof(${table.metadata}) = 'object' and octet_length(${table.metadata}::text) <= 4096`,
    ),
    index('platform_audit_created').on(table.createdAt.desc(), table.id),
    index('platform_audit_actor_created').on(
      table.actorUserId,
      table.createdAt.desc(),
      table.id,
    ),
  ],
);
