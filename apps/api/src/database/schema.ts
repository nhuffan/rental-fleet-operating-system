import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
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
export const branches = pgTable('branches', {
  id: uuid().primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id),
  name: text().notNull(),
  address: text().notNull().default(''),
  status: text().notNull().default('ACTIVE'),
  ...times(),
});
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
