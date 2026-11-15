import { z } from 'zod';
import type { Permission } from '../auth/permissions.js';

const page = {
  page: z.number().int().min(1).max(1000).default(1),
  limit: z.number().int().min(1).max(20).default(10),
};
const dateTime = z.iso.datetime({ offset: true });

export const AI_TOOL_DEFINITIONS = {
  get_operational_alerts: {
    description:
      'Read active rental, compliance and GPS TEST alerts. Due soon means the next 24 hours.',
    permission: 'alert.read',
    inputSchema: z.strictObject({
      ...page,
      kind: z
        .enum([
          'RENTAL_OVERDUE',
          'RENTAL_DUE_SOON',
          'GPS_STALE',
          'VEHICLE_REGISTRATION_DUE',
          'VEHICLE_INSURANCE_DUE',
          'VEHICLE_MAINTENANCE_DUE',
        ])
        .optional(),
      severity: z.enum(['CRITICAL', 'WARNING']).optional(),
    }),
  },
  get_fleet_vehicles: {
    description:
      'List vehicles in the selected business, optionally by status.',
    permission: 'vehicle.read',
    inputSchema: z.strictObject({
      ...page,
      status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    }),
  },
  get_vehicle_details: {
    description: 'Read status and compliance dates for a known vehicle UUID.',
    permission: 'vehicle.read',
    inputSchema: z.strictObject({ vehicleId: z.uuid() }),
  },
  get_rental_overview: {
    description: 'List rental periods and statuses without customer details.',
    permission: 'rental.read',
    inputSchema: z.strictObject({
      ...page,
      status: z
        .enum(['DRAFT', 'RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
        .optional(),
      vehicleId: z.uuid().optional(),
      overdue: z.boolean().optional(),
    }),
  },
  get_vehicle_availability: {
    description:
      'List available vehicles for an explicit offset date-time interval of at most 90 days. Advisory only.',
    permission: 'rental.read',
    inputSchema: z.strictObject({
      ...page,
      startAt: dateTime,
      endAt: dateTime,
    }),
  },
  get_business_report: {
    description:
      'Read recorded financial totals, rental counts and estimated fleet utilization. Defaults to the last 30 days.',
    permission: 'report.read',
    inputSchema: z.strictObject({
      from: dateTime.optional(),
      until: dateTime.optional(),
    }),
  },
} satisfies Record<
  string,
  { description: string; permission: Permission; inputSchema: z.ZodObject }
>;

export type AiToolName = keyof typeof AI_TOOL_DEFINITIONS;

export function isAiToolName(value: unknown): value is AiToolName {
  return typeof value === 'string' && Object.hasOwn(AI_TOOL_DEFINITIONS, value);
}
