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
  primaryKey,
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
    pricingDraft: jsonb('pricing_draft').$type<{
      billingMode?: 'HOURLY' | 'DAILY';
      expectedQuoteHash?: string;
      overrideAmount?: string;
      overrideReason?: string;
    }>(),
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
    unique('rentals_retention_identity_unique').on(table.businessId, table.id),
    unique('rentals_business_id_id_vehicle_unique').on(
      table.businessId,
      table.id,
      table.vehicleId,
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

export const rentalRateCards = pgTable(
  'rental_rate_cards',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id'),
    name: text().notNull(),
    hourlyRate: numeric('hourly_rate'),
    dailyRate: numeric('daily_rate'),
    minimumCharge: numeric('minimum_charge').notNull().default('0'),
    extraHourRate: numeric('extra_hour_rate'),
    effectiveFrom: timestamp('effective_from', {
      withTimezone: true,
    }).notNull(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    status: text().notNull().default('ACTIVE').$type<'ACTIVE' | 'INACTIVE'>(),
    version: integer().notNull().default(1),
    createdBy: uuid('created_by').notNull(),
    ...times(),
  },
  (t) => [
    unique('rental_rate_cards_tenant_identity').on(t.businessId, t.id),
    foreignKey({
      name: 'rental_rate_cards_vehicle_tenant_fk',
      columns: [t.businessId, t.vehicleId],
      foreignColumns: [vehicles.businessId, vehicles.id],
    }).onDelete('restrict'),
    index('rental_rate_cards_business_scope_effective').on(
      t.businessId,
      t.vehicleId,
      t.effectiveFrom,
      t.id,
    ),
  ],
);
export const rentalQuoteSnapshots = pgTable(
  'rental_quote_snapshots',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    rentalId: uuid('rental_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    rateCardId: uuid('rate_card_id'),
    mode: text().notNull().$type<'CALCULATED' | 'OVERRIDE' | 'MANUAL'>(),
    breakdown: jsonb().$type<import('../pricing/engine.js').QuoteBreakdown>(),
    agreedAmount: numeric('agreed_amount').notNull(),
    overrideReason: text('override_reason'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('rental_quote_snapshots_rental_unique').on(t.businessId, t.rentalId),
    foreignKey({
      name: 'rental_quote_snapshots_rental_tenant_fk',
      columns: [t.businessId, t.rentalId, t.vehicleId],
      foreignColumns: [rentals.businessId, rentals.id, rentals.vehicleId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'rental_quote_snapshots_rate_tenant_fk',
      columns: [t.businessId, t.rateCardId],
      foreignColumns: [rentalRateCards.businessId, rentalRateCards.id],
    }).onDelete('restrict'),
    index('rental_quote_snapshots_rate').on(t.businessId, t.rateCardId),
  ],
);

export const rentalInspections = pgTable(
  'rental_inspections',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    rentalId: uuid('rental_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    type: text().notNull().$type<'HANDOVER' | 'RETURN'>(),
    // No actor/profile FK: immutable historical attribution survives identity removal.
    actorId: uuid('actor_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    odometer: integer().notNull(),
    fuelPercent: integer('fuel_percent').notNull(),
    exteriorCondition: text('exterior_condition')
      .notNull()
      .$type<'GOOD' | 'DAMAGED'>(),
    interiorCondition: text('interior_condition')
      .notNull()
      .$type<'GOOD' | 'DAMAGED'>(),
    spareTire: text('spare_tire')
      .notNull()
      .$type<'PRESENT' | 'MISSING' | 'NOT_APPLICABLE'>(),
    tools: text().notNull().$type<'PRESENT' | 'MISSING' | 'NOT_APPLICABLE'>(),
    registrationDocument: text('registration_document')
      .notNull()
      .$type<'PRESENT' | 'MISSING' | 'NOT_APPLICABLE'>(),
    insuranceDocument: text('insurance_document')
      .notNull()
      .$type<'PRESENT' | 'MISSING' | 'NOT_APPLICABLE'>(),
    keys: text().notNull().$type<'PRESENT' | 'MISSING' | 'NOT_APPLICABLE'>(),
    damageNotes: text('damage_notes').notNull().default(''),
    notes: text().notNull().default(''),
  },
  (table) => [
    foreignKey({
      name: 'rental_inspections_rental_tenant_fk',
      columns: [table.businessId, table.rentalId, table.vehicleId],
      foreignColumns: [rentals.businessId, rentals.id, rentals.vehicleId],
    }).onDelete('restrict'),
    unique('rental_inspections_evidence_identity_unique').on(
      table.businessId,
      table.id,
      table.rentalId,
      table.vehicleId,
      table.type,
    ),
    unique('rental_inspections_rental_type_unique').on(
      table.businessId,
      table.rentalId,
      table.type,
    ),
    check(
      'rental_inspections_type_check',
      sql`${table.type} in ('HANDOVER', 'RETURN')`,
    ),
    check('rental_inspections_time_check', sql`isfinite(${table.recordedAt})`),
    check(
      'rental_inspections_odometer_check',
      sql`${table.odometer} between 0 and 2147483647`,
    ),
    check(
      'rental_inspections_fuel_check',
      sql`${table.fuelPercent} between 0 and 100`,
    ),
    check(
      'rental_inspections_condition_check',
      sql`${table.exteriorCondition} in ('GOOD', 'DAMAGED') and ${table.interiorCondition} in ('GOOD', 'DAMAGED')`,
    ),
    check(
      'rental_inspections_checklist_check',
      sql`
        ${table.spareTire} in ('PRESENT', 'MISSING', 'NOT_APPLICABLE') and
        ${table.tools} in ('PRESENT', 'MISSING', 'NOT_APPLICABLE') and
        ${table.registrationDocument} in ('PRESENT', 'MISSING', 'NOT_APPLICABLE') and
        ${table.insuranceDocument} in ('PRESENT', 'MISSING', 'NOT_APPLICABLE') and
        ${table.keys} in ('PRESENT', 'MISSING', 'NOT_APPLICABLE')
      `,
    ),
    check(
      'rental_inspections_notes_check',
      sql`length(${table.notes}) <= 2000 and length(${table.damageNotes}) <= 2000`,
    ),
    check(
      'rental_inspections_damage_notes_check',
      sql`(${table.exteriorCondition} <> 'DAMAGED' and ${table.interiorCondition} <> 'DAMAGED') or ${table.damageNotes} !~ '^[[:space:]]*$'`,
    ),
    // UPDATE/DELETE immutability trigger and read-only browser RLS live in SQL.
    index('rental_inspections_vehicle_recorded').on(
      table.businessId,
      table.vehicleId,
      table.recordedAt.desc(),
      table.id.desc(),
    ),
  ],
);

// SQL owns bounded metadata/path checks, immutable evidence triggers and read-only RLS.
export const evidenceUploads = pgTable(
  'inspection_uploads',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    rentalId: uuid('rental_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    type: text().notNull().$type<'HANDOVER' | 'RETURN'>(),
    kind: text().notNull().$type<'IMAGE' | 'VIDEO'>(),
    category: text()
      .notNull()
      .$type<
        | 'FRONT'
        | 'REAR'
        | 'LEFT'
        | 'RIGHT'
        | 'INTERIOR'
        | 'DASHBOARD'
        | 'DAMAGE'
        | 'OTHER'
      >(),
    uploadedBy: uuid('uploaded_by').notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    status: text()
      .notNull()
      .default('PENDING')
      .$type<
        | 'PENDING'
        | 'VERIFYING'
        | 'VERIFIED'
        | 'ATTACHED'
        | 'CANCELLED'
        | 'REJECTED'
        | 'PURGED'
      >(),
    bucket: text().notNull(),
    pendingKey: text('pending_key').notNull(),
    objectKey: text('object_key').notNull(),
    declaredMime: text('declared_mime').notNull(),
    declaredBytes: integer('declared_bytes').notNull(),
    mimeType: text('mime_type'),
    bytes: integer(),
    width: integer(),
    height: integer(),
    durationSeconds: doublePrecision('duration_seconds'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    holdUntil: timestamp('hold_until', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    reservedBytes: integer('reserved_bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'inspection_uploads_rental_tenant_fk',
      columns: [table.businessId, table.rentalId, table.vehicleId],
      foreignColumns: [rentals.businessId, rentals.id, rentals.vehicleId],
    }).onDelete('restrict'),
    unique('inspection_uploads_idempotency_unique').on(
      table.businessId,
      table.uploadedBy,
      table.idempotencyKey,
    ),
    unique('inspection_uploads_identity_unique').on(
      table.businessId,
      table.id,
      table.rentalId,
      table.vehicleId,
      table.type,
    ),
    unique('inspection_uploads_pending_unique').on(
      table.bucket,
      table.pendingKey,
    ),
    unique('inspection_uploads_object_unique').on(
      table.bucket,
      table.objectKey,
    ),
    index('inspection_uploads_milestone').on(
      table.businessId,
      table.rentalId,
      table.type,
      table.status,
    ),
    index('inspection_uploads_cleanup')
      .on(table.holdUntil, table.id)
      .where(sql`${table.holdUntil} is not null`),
  ],
);

export const evidenceAttachments = pgTable(
  'inspection_evidence',
  {
    id: uuid().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    rentalId: uuid('rental_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    inspectionId: uuid('inspection_id').notNull(),
    type: text().notNull().$type<'HANDOVER' | 'RETURN'>(),
    kind: text().notNull().$type<'IMAGE' | 'VIDEO'>(),
    category: text()
      .notNull()
      .$type<
        | 'FRONT'
        | 'REAR'
        | 'LEFT'
        | 'RIGHT'
        | 'INTERIOR'
        | 'DASHBOARD'
        | 'DAMAGE'
        | 'OTHER'
      >(),
    uploadedBy: uuid('uploaded_by').notNull(),
    bucket: text().notNull(),
    objectKey: text('object_key').notNull(),
    mimeType: text('mime_type').notNull(),
    bytes: integer().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    durationSeconds: doublePrecision('duration_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'inspection_evidence_inspection_tenant_fk',
      columns: [
        table.businessId,
        table.inspectionId,
        table.rentalId,
        table.vehicleId,
        table.type,
      ],
      foreignColumns: [
        rentalInspections.businessId,
        rentalInspections.id,
        rentalInspections.rentalId,
        rentalInspections.vehicleId,
        rentalInspections.type,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'inspection_evidence_upload_tenant_fk',
      columns: [
        table.businessId,
        table.id,
        table.rentalId,
        table.vehicleId,
        table.type,
      ],
      foreignColumns: [
        evidenceUploads.businessId,
        evidenceUploads.id,
        evidenceUploads.rentalId,
        evidenceUploads.vehicleId,
        evidenceUploads.type,
      ],
    }).onDelete('restrict'),
    unique('inspection_evidence_retention_identity_unique').on(
      table.businessId,
      table.id,
      table.rentalId,
    ),
    unique('inspection_evidence_object_unique').on(
      table.bucket,
      table.objectKey,
    ),
    index('inspection_evidence_rental').on(
      table.businessId,
      table.rentalId,
      table.type,
      table.createdAt,
      table.id,
    ),
    index('inspection_evidence_vehicle').on(
      table.businessId,
      table.vehicleId,
      table.createdAt.desc(),
      table.id,
    ),
    index('inspection_evidence_inspection').on(
      table.businessId,
      table.inspectionId,
      table.rentalId,
      table.vehicleId,
      table.type,
    ),
  ],
);

// Retention state and history remain separate from immutable inspection metadata.
export const evidenceRetentionSettings = pgTable(
  'evidence_retention_settings',
  {
    businessId: uuid('business_id')
      .primaryKey()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    retentionDays: integer('retention_days')
      .notNull()
      .default(30)
      .$type<30 | 90>(),
    updatedBy: uuid('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'evidence_retention_settings_days_check',
      sql`${table.retentionDays} in (30, 90)`,
    ),
  ],
);

export const evidenceRentalHolds = pgTable(
  'evidence_rental_holds',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    rentalId: uuid('rental_id').notNull(),
    active: boolean().notNull().default(false),
    unresolvedDispute: boolean('unresolved_dispute').notNull().default(false),
    reason: text().notNull(),
    actorId: uuid('actor_id').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.businessId, table.rentalId] }),
    foreignKey({
      name: 'evidence_rental_holds_rental_tenant_fk',
      columns: [table.businessId, table.rentalId],
      foreignColumns: [rentals.businessId, rentals.id],
    }).onDelete('restrict'),
    check(
      'evidence_rental_holds_dispute_check',
      sql`not ${table.unresolvedDispute} or ${table.active}`,
    ),
    index('evidence_rental_holds_active')
      .on(table.businessId, table.rentalId)
      .where(sql`${table.active}`),
  ],
);

export type EvidenceLifecycleStatus =
  'ACTIVE' | 'PURGE_ELIGIBLE' | 'PURGING' | 'PURGED' | 'RETRY_REQUIRED';
export const evidenceLifecycles = pgTable(
  'evidence_lifecycles',
  {
    evidenceId: uuid('evidence_id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    rentalId: uuid('rental_id').notNull(),
    status: text().notNull().default('ACTIVE').$type<EvidenceLifecycleStatus>(),
    important: boolean().notNull().default(false),
    importantReason: text('important_reason'),
    importantBy: uuid('important_by'),
    importantAt: timestamp('important_at', { withTimezone: true }),
    leaseId: uuid('lease_id'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    retryCount: integer('retry_count').notNull().default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    purgedAt: timestamp('purged_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'evidence_lifecycles_evidence_tenant_fk',
      columns: [table.businessId, table.evidenceId, table.rentalId],
      foreignColumns: [
        evidenceAttachments.businessId,
        evidenceAttachments.id,
        evidenceAttachments.rentalId,
      ],
    }).onDelete('restrict'),
    index('evidence_lifecycles_tenant_rental').on(
      table.businessId,
      table.rentalId,
      table.evidenceId,
    ),
    index('evidence_lifecycles_cleanup')
      .on(table.status, table.nextRetryAt, table.leaseUntil, table.evidenceId)
      .where(sql`${table.status} <> 'PURGED'`),
  ],
);

export const evidenceRetentionEvents = pgTable(
  'evidence_retention_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    rentalId: uuid('rental_id'),
    evidenceId: uuid('evidence_id'),
    action: text().notNull(),
    actorId: uuid('actor_id'),
    reason: text(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'evidence_retention_events_rental_tenant_fk',
      columns: [table.businessId, table.rentalId],
      foreignColumns: [rentals.businessId, rentals.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'evidence_retention_events_evidence_tenant_fk',
      columns: [table.businessId, table.evidenceId, table.rentalId],
      foreignColumns: [
        evidenceAttachments.businessId,
        evidenceAttachments.id,
        evidenceAttachments.rentalId,
      ],
    }).onDelete('restrict'),
    index('evidence_retention_events_business_created').on(
      table.businessId,
      table.createdAt.desc(),
      table.id,
    ),
    index('evidence_retention_events_rental').on(
      table.businessId,
      table.rentalId,
      table.createdAt,
      table.id,
    ),
    index('evidence_retention_events_evidence').on(
      table.businessId,
      table.evidenceId,
      table.rentalId,
    ),
  ],
);

export const commercialMovements = pgTable(
  'commercial_movements',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id'),
    rentalId: uuid('rental_id'),
    kind: text()
      .notNull()
      .$type<
        | 'RENTAL_PAYMENT'
        | 'MISC_INCOME'
        | 'DEPOSIT_RECEIPT'
        | 'DEPOSIT_REFUND'
        | 'DEPOSIT_RETAIN'
        | 'EXPENSE'
      >(),
    category: text()
      .notNull()
      .$type<
        | 'RENTAL'
        | 'OTHER_INCOME'
        | 'DEPOSIT'
        | 'FUEL'
        | 'MAINTENANCE'
        | 'TOLL'
        | 'INSURANCE'
        | 'OTHER_EXPENSE'
      >(),
    amount: numeric({ precision: 18, scale: 0 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    reference: text().notNull().default(''),
    notes: text().notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').notNull(),
    reversalOf: uuid('reversal_of'),
  },
  (table) => [
    unique('commercial_movements_business_id_id_unique').on(
      table.businessId,
      table.id,
    ),
    unique('commercial_movements_reversal_unique').on(table.reversalOf),
    foreignKey({
      name: 'commercial_movements_vehicle_tenant_fk',
      columns: [table.businessId, table.vehicleId],
      foreignColumns: [vehicles.businessId, vehicles.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'commercial_movements_rental_tenant_fk',
      columns: [table.businessId, table.rentalId, table.vehicleId],
      foreignColumns: [rentals.businessId, rentals.id, rentals.vehicleId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'commercial_movements_reversal_tenant_fk',
      columns: [table.businessId, table.reversalOf],
      foreignColumns: [table.businessId, table.id],
    }).onDelete('restrict'),
    check(
      'commercial_movements_kind_check',
      sql`${table.kind} in ('RENTAL_PAYMENT', 'MISC_INCOME', 'DEPOSIT_RECEIPT', 'DEPOSIT_REFUND', 'DEPOSIT_RETAIN', 'EXPENSE')`,
    ),
    check(
      'commercial_movements_category_check',
      sql`
      (${table.kind} = 'RENTAL_PAYMENT' and ${table.category} = 'RENTAL') or
      (${table.kind} = 'MISC_INCOME' and ${table.category} = 'OTHER_INCOME') or
      (${table.kind} in ('DEPOSIT_RECEIPT', 'DEPOSIT_REFUND', 'DEPOSIT_RETAIN') and ${table.category} = 'DEPOSIT') or
      (${table.kind} = 'EXPENSE' and ${table.category} in ('FUEL', 'MAINTENANCE', 'TOLL', 'INSURANCE', 'OTHER_EXPENSE'))
    `,
    ),
    check(
      'commercial_movements_amount_check',
      sql`${table.amount} > 0 and ${table.amount} <= 999999999999999 and ${table.amount} <> 'NaN'::numeric`,
    ),
    check(
      'commercial_movements_time_check',
      sql`isfinite(${table.occurredAt}) and isfinite(${table.createdAt})`,
    ),
    check(
      'commercial_movements_reference_check',
      sql`length(${table.reference}) <= 160`,
    ),
    check(
      'commercial_movements_notes_check',
      sql`length(${table.notes}) <= 2000`,
    ),
    check(
      'commercial_movements_rental_vehicle_check',
      sql`${table.rentalId} is null or ${table.vehicleId} is not null`,
    ),
    check(
      'commercial_movements_rental_required_check',
      sql`${table.kind} in ('MISC_INCOME', 'EXPENSE') or ${table.rentalId} is not null`,
    ),
    check(
      'commercial_movements_reversal_self_check',
      sql`${table.reversalOf} is null or ${table.reversalOf} <> ${table.id}`,
    ),
    index('commercial_movements_business_occurred').on(
      table.businessId,
      table.occurredAt.desc(),
      table.id,
    ),
    index('commercial_movements_vehicle_occurred').on(
      table.businessId,
      table.vehicleId,
      table.occurredAt.desc(),
      table.id,
    ),
    index('commercial_movements_rental_occurred').on(
      table.businessId,
      table.rentalId,
      table.vehicleId,
      table.occurredAt.desc(),
      table.id,
    ),
    index('commercial_movements_category_occurred').on(
      table.businessId,
      table.category,
      table.occurredAt.desc(),
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

export const tollImportBatches = pgTable(
  'toll_import_batches',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    source: text().notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    contentHash: text('content_hash').notNull(),
    rowCount: integer('row_count').notNull(),
    importedCount: integer('imported_count').notNull(),
    duplicateCount: integer('duplicate_count').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('toll_import_batches_tenant_identity').on(t.businessId, t.id),
    unique('toll_import_batches_source_identity').on(
      t.businessId,
      t.id,
      t.source,
    ),
    unique('toll_import_batches_idempotency').on(
      t.businessId,
      t.idempotencyKey,
    ),
    index('toll_import_batches_business_created').on(
      t.businessId,
      t.createdAt.desc(),
      t.id,
    ),
  ],
);
export type TollStatus =
  'UNMATCHED' | 'NEEDS_REVIEW' | 'MATCHED' | 'RECORDED' | 'IGNORED';
export const tollTransactions = pgTable(
  'toll_transactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    batchId: uuid('batch_id').notNull(),
    source: text().notNull(),
    externalReference: text('external_reference').notNull().default(''),
    fingerprint: text().notNull(),
    plate: text().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    amount: numeric({ precision: 18, scale: 0 }).notNull(),
    station: text().notNull().default(''),
    description: text().notNull().default(''),
    importRow: integer('import_row').notNull(),
    status: text().notNull().default('UNMATCHED').$type<TollStatus>(),
    vehicleId: uuid('vehicle_id'),
    rentalId: uuid('rental_id'),
    movementId: uuid('movement_id'),
    reviewReason: text('review_reason').notNull().default(''),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    version: integer().notNull().default(1),
    ...times(),
  },
  (t) => [
    unique('toll_transactions_tenant_identity').on(t.businessId, t.id),
    foreignKey({
      name: 'toll_transactions_batch_tenant_fk',
      columns: [t.businessId, t.batchId, t.source],
      foreignColumns: [
        tollImportBatches.businessId,
        tollImportBatches.id,
        tollImportBatches.source,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'toll_transactions_vehicle_tenant_fk',
      columns: [t.businessId, t.vehicleId],
      foreignColumns: [vehicles.businessId, vehicles.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'toll_transactions_rental_tenant_fk',
      columns: [t.businessId, t.rentalId, t.vehicleId],
      foreignColumns: [rentals.businessId, rentals.id, rentals.vehicleId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'toll_transactions_movement_tenant_fk',
      columns: [t.businessId, t.movementId],
      foreignColumns: [commercialMovements.businessId, commercialMovements.id],
    }).onDelete('restrict'),
    uniqueIndex('toll_transactions_external_unique')
      .on(t.businessId, t.source, t.externalReference)
      .where(sql`${t.externalReference} <> ''`),
    uniqueIndex('toll_transactions_fingerprint_unique')
      .on(t.businessId, t.source, t.fingerprint)
      .where(sql`${t.externalReference} = ''`),
    uniqueIndex('toll_transactions_movement_unique')
      .on(t.businessId, t.movementId)
      .where(sql`${t.movementId} is not null`),
    index('toll_transactions_business_occurred').on(
      t.businessId,
      t.occurredAt.desc(),
      t.id,
    ),
    index('toll_transactions_business_status').on(
      t.businessId,
      t.status,
      t.occurredAt.desc(),
      t.id,
    ),
    index('toll_transactions_vehicle_occurred').on(
      t.businessId,
      t.vehicleId,
      t.occurredAt.desc(),
      t.id,
    ),
    index('toll_transactions_rental').on(
      t.businessId,
      t.rentalId,
      t.vehicleId,
      t.occurredAt.desc(),
      t.id,
    ),
    index('toll_transactions_batch').on(t.businessId, t.batchId, t.id),
    index('toll_transactions_fingerprint').on(
      t.businessId,
      t.source,
      t.fingerprint,
    ),
  ],
);
export const tollReviewEvents = pgTable(
  'toll_review_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    tollTransactionId: uuid('toll_transaction_id').notNull(),
    action: text()
      .notNull()
      .$type<'IMPORTED' | 'MATCH_CONFIRMED' | 'IGNORED' | 'RECORDED'>(),
    vehicleId: uuid('vehicle_id'),
    rentalId: uuid('rental_id'),
    status: text().notNull().$type<TollStatus>(),
    version: integer().notNull(),
    actorId: uuid('actor_id').notNull(),
    reason: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'toll_review_events_transaction_tenant_fk',
      columns: [t.businessId, t.tollTransactionId],
      foreignColumns: [tollTransactions.businessId, tollTransactions.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'toll_review_events_vehicle_tenant_fk',
      columns: [t.businessId, t.vehicleId],
      foreignColumns: [vehicles.businessId, vehicles.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'toll_review_events_rental_tenant_fk',
      columns: [t.businessId, t.rentalId, t.vehicleId],
      foreignColumns: [rentals.businessId, rentals.id, rentals.vehicleId],
    }).onDelete('restrict'),
    index('toll_review_events_rental').on(
      t.businessId,
      t.rentalId,
      t.vehicleId,
    ),
    index('toll_review_events_vehicle').on(t.businessId, t.vehicleId),
    index('toll_review_events_transaction').on(
      t.businessId,
      t.tollTransactionId,
      t.createdAt,
      t.id,
    ),
  ],
);
