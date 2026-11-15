import { randomUUID } from 'node:crypto';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AlertsService } from '../alerts/alerts.service.js';
import type { AlertResponse } from '../alerts/dto.js';
import type { TenantContext } from '../auth/guards.js';
import { permissionsFor } from '../auth/permissions.js';
import { Database } from '../database/database.js';
import { businesses, memberships, profiles } from '../database/schema.js';
import { FleetService } from '../fleet/vehicles/fleet.service.js';
import { RentalService } from '../rentals/rental.service.js';
import { ReportsService } from '../reports/reports.service.js';
import {
  AI_TOOL_DEFINITIONS,
  type AiToolName,
  isAiToolName,
} from './ai-tool-contract.js';

export { AI_TOOL_DEFINITIONS, isAiToolName };
export type { AiToolName };

const MAX_RESULT_BYTES = 24 * 1024;
const TOOL_TIMEOUT_MS = 12_000;
const MAX_AVAILABILITY_MS = 90 * 86_400_000;

const errorMessages = {
  AI_TOOL_UNKNOWN: 'Unknown tool',
  AI_TOOL_INVALID_INPUT: 'Invalid tool input',
  AI_TOOL_DENIED: 'Tool access denied',
  AI_TOOL_NOT_FOUND: 'Requested resource not found',
  AI_TOOL_UNAVAILABLE: 'Tool temporarily unavailable',
  AI_TOOL_TIMEOUT: 'Tool timed out',
  AI_TOOL_RESULT_TOO_LARGE: 'Tool result is too large',
};

export class AiToolError extends Error {
  constructor(readonly code: keyof typeof errorMessages) {
    super(errorMessages[code]);
    this.name = 'AiToolError';
  }
}

export type AiSourceReference = { id: string; label: string; path: string };

type Page = { page: number; limit: number; total: number };
type Vehicle = Pick<
  Awaited<ReturnType<FleetService['vehicle']>>,
  'id' | 'licensePlate' | 'status'
>;
type VehicleDetails = Vehicle &
  Pick<
    Awaited<ReturnType<FleetService['vehicle']>>,
    | 'registrationExpiresOn'
    | 'insuranceExpiresOn'
    | 'nextMaintenanceOn'
    | 'nextMaintenanceOdometer'
  >;
type Alert = Pick<
  AlertResponse,
  | 'kind'
  | 'severity'
  | 'vehicleId'
  | 'licensePlate'
  | 'rentalId'
  | 'dueAt'
  | 'lastSeenAt'
  | 'gpsState'
  | 'sourceMode'
>;
type Rental = {
  id: string;
  vehicleId: string;
  licensePlate: string;
  status: string;
  startAt: string;
  endAt: string;
  isOverdue: boolean;
};
type Report = Omit<
  Awaited<ReturnType<ReportsService['summary']>>,
  'months' | 'vehicles'
>;

type ToolData = {
  get_operational_alerts: Page & { items: Alert[]; dueSoonSeconds: number };
  get_fleet_vehicles: Page & { items: Vehicle[] };
  get_vehicle_details: VehicleDetails;
  get_rental_overview: Page & { items: Rental[] };
  get_vehicle_availability: Page & {
    items: (Vehicle & { available: boolean })[];
    startAt: string;
    endAt: string;
  };
  get_business_report: Report;
};

type AiToolPayload = {
  [Name in AiToolName]: {
    tool: Name;
    data: ToolData[Name];
    asOf?: string;
    sourceReferences: AiSourceReference[];
    limitations: string[];
    moreAvailable: boolean;
  };
}[AiToolName];

export type AiToolResult = AiToolPayload & {
  readAt: string;
  traceId: string;
};

function vehicleView(vehicle: Vehicle): Vehicle {
  return {
    id: vehicle.id,
    licensePlate: vehicle.licensePlate,
    status: vehicle.status,
  };
}

const vehicleId = z.uuid();
function vehicleReferences(vehicles: { id: string; licensePlate: string }[]) {
  return [...new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])).values()]
    .filter(({ id }) => vehicleId.safeParse(id).success)
    .map(({ id, licensePlate }) => ({
      id: `vehicle:${id}`,
      label: `Xe ${licensePlate}`,
      path: `/app/vehicles/${id}`,
    }));
}

function pageView({ page, limit, total }: Page) {
  return { page, limit, total };
}

function moreAvailable({ page, limit, total }: Page) {
  return page * limit < total;
}

function sanitizedError(error: unknown) {
  if (error instanceof AiToolError) return error;
  if (error instanceof z.ZodError)
    return new AiToolError('AI_TOOL_INVALID_INPUT');
  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status === 400) return new AiToolError('AI_TOOL_INVALID_INPUT');
    if (status === 401 || status === 403)
      return new AiToolError('AI_TOOL_DENIED');
    if (status === 404) return new AiToolError('AI_TOOL_NOT_FOUND');
  }
  return new AiToolError('AI_TOOL_UNAVAILABLE');
}

@Injectable()
export class AiTools {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(AlertsService) private readonly alerts: AlertsService,
    @Inject(FleetService) private readonly fleet: FleetService,
    @Inject(RentalService) private readonly rentals: RentalService,
    @Inject(ReportsService) private readonly reports: ReportsService,
  ) {}

  // Recheck the same selected membership on every tool call, including calls
  // after an LLM round trip. Never fall back to a different active business.
  private async assertActiveOwner(context: TenantContext) {
    const [member] = await this.database.db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(businesses, eq(businesses.id, memberships.businessId))
      .innerJoin(profiles, eq(profiles.userId, memberships.userId))
      .where(
        and(
          eq(memberships.id, context.membershipId),
          eq(memberships.businessId, context.businessId),
          eq(memberships.userId, context.userId),
          eq(memberships.roleKey, 'OWNER'),
          eq(memberships.status, 'ACTIVE'),
          eq(businesses.status, 'ACTIVE'),
          eq(profiles.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!member) throw new AiToolError('AI_TOOL_DENIED');
  }

  async execute(
    context: TenantContext,
    name: string,
    input: unknown,
  ): Promise<AiToolResult> {
    if (!isAiToolName(name)) throw new AiToolError('AI_TOOL_UNKNOWN');
    if (
      context?.role !== 'OWNER' ||
      !permissionsFor(context.role).includes(
        AI_TOOL_DEFINITIONS[name].permission,
      )
    )
      throw new AiToolError('AI_TOOL_DENIED');

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // The deadline bounds callers while the DB pool enforces its own
      // statement and connection timeouts.
      const controller = new AbortController();
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new AiToolError('AI_TOOL_TIMEOUT'));
        }, TOOL_TIMEOUT_MS);
        timeout.unref();
      });
      const result = await Promise.race([
        this.read(context, name, input, controller.signal),
        deadline,
      ]);
      const output: AiToolResult = {
        ...result,
        readAt: new Date().toISOString(),
        traceId: randomUUID(),
      };
      if (Buffer.byteLength(JSON.stringify(output)) > MAX_RESULT_BYTES)
        throw new AiToolError('AI_TOOL_RESULT_TOO_LARGE');
      return output;
    } catch (error) {
      throw sanitizedError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async read(
    context: TenantContext,
    name: AiToolName,
    input: unknown,
    deadline: AbortSignal,
  ): Promise<AiToolPayload> {
    await this.assertActiveOwner(context);
    if (deadline.aborted) throw new AiToolError('AI_TOOL_TIMEOUT');
    switch (name) {
      case 'get_operational_alerts': {
        const query = AI_TOOL_DEFINITIONS[name].inputSchema.parse(input);
        const result = await this.alerts.list(context, query);
        const items = result.data.map(
          ({
            kind,
            severity,
            vehicleId,
            licensePlate,
            rentalId,
            dueAt,
            lastSeenAt,
            gpsState,
            sourceMode,
          }): Alert => ({
            kind,
            severity,
            vehicleId,
            licensePlate,
            rentalId,
            dueAt,
            lastSeenAt,
            gpsState,
            sourceMode,
          }),
        );
        const filter = new URLSearchParams();
        if (query.kind) filter.set('kind', query.kind);
        if (query.severity) filter.set('severity', query.severity);
        const path = filter.size ? `/app/alerts?${filter}` : '/app/alerts';
        return {
          tool: name,
          data: {
            ...pageView(result),
            items,
            dueSoonSeconds: result.rules.dueSoonSeconds,
          },
          asOf: result.asOf,
          sourceReferences: [
            { id: 'alerts', label: 'Cảnh báo vận hành', path },
            ...vehicleReferences(
              items.map(({ vehicleId: id, licensePlate }) => ({
                id,
                licensePlate,
              })),
            ),
          ],
          limitations: [
            'Cảnh báo GPS chỉ dựa trên dữ liệu TEST đã ghi nhận.',
            'Sắp đến hạn trả nghĩa là trong 24 giờ tiếp theo.',
          ],
          moreAvailable: moreAvailable(result),
        };
      }
      case 'get_fleet_vehicles': {
        const query = AI_TOOL_DEFINITIONS[name].inputSchema.parse(input);
        const result = await this.fleet.listVehicles(context, {
          ...query,
          sort: 'licensePlate',
          order: 'asc',
        });
        const items = result.data.map(vehicleView);
        return {
          tool: name,
          data: { ...pageView(result), items },
          sourceReferences: [
            { id: 'fleet', label: 'Đội xe', path: '/app/vehicles' },
            ...vehicleReferences(items),
          ],
          limitations: [],
          moreAvailable: moreAvailable(result),
        };
      }
      case 'get_vehicle_details': {
        const { vehicleId } =
          AI_TOOL_DEFINITIONS[name].inputSchema.parse(input);
        const row = await this.fleet.vehicle(context, vehicleId);
        return {
          tool: name,
          data: {
            ...vehicleView(row),
            registrationExpiresOn: row.registrationExpiresOn,
            insuranceExpiresOn: row.insuranceExpiresOn,
            nextMaintenanceOn: row.nextMaintenanceOn,
            nextMaintenanceOdometer: row.nextMaintenanceOdometer,
          },
          sourceReferences: vehicleReferences([row]),
          limitations: [],
          moreAvailable: false,
        };
      }
      case 'get_rental_overview': {
        const query = AI_TOOL_DEFINITIONS[name].inputSchema.parse(input);
        const result = await this.rentals.listRentals(context, {
          ...query,
          sort: 'endAt',
          order: 'asc',
        });
        const items = result.data.map(
          ({
            id,
            vehicleId,
            vehicle,
            status,
            startAt,
            endAt,
            isOverdue,
          }): Rental => ({
            id,
            vehicleId,
            licensePlate: vehicle.licensePlate,
            status,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            isOverdue,
          }),
        );
        return {
          tool: name,
          data: { ...pageView(result), items },
          sourceReferences: [
            {
              id: 'rentals',
              label: 'Danh sách hợp đồng thuê',
              path: '/app/rentals',
            },
          ],
          limitations: [],
          moreAvailable: moreAvailable(result),
        };
      }
      case 'get_vehicle_availability': {
        const query = AI_TOOL_DEFINITIONS[name].inputSchema.parse(input);
        const start = new Date(query.startAt);
        const end = new Date(query.endAt);
        const window = end.getTime() - start.getTime();
        if (
          !Number.isFinite(window) ||
          window <= 0 ||
          window > MAX_AVAILABILITY_MS
        )
          throw new AiToolError('AI_TOOL_INVALID_INPUT');
        const result = await this.rentals.availability(context, {
          ...query,
          availableOnly: true,
        });
        const items = result.data.map((row) => ({
          ...vehicleView(row),
          available: row.available,
        }));
        return {
          tool: name,
          data: {
            ...pageView(result),
            items,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
          },
          sourceReferences: [
            { id: 'availability', label: 'Lịch thuê', path: '/app/rentals' },
            ...vehicleReferences(items),
          ],
          limitations: ['Kết quả chỉ để tham khảo và không giữ chỗ cho xe.'],
          moreAvailable: moreAvailable(result),
        };
      }
      case 'get_business_report': {
        const query = AI_TOOL_DEFINITIONS[name].inputSchema.parse(input);
        const result = await this.reports.summary(context, query);
        return {
          tool: name,
          data: {
            currency: result.currency,
            basis: result.basis,
            from: result.from,
            until: result.until,
            recordedRevenue: result.recordedRevenue,
            cashReceived: result.cashReceived,
            operatingExpenses: result.operatingExpenses,
            estimatedProfit: result.estimatedProfit,
            depositHeld: result.depositHeld,
            fleetUtilizationPercent: result.fleetUtilizationPercent,
            activeVehicles: result.activeVehicles,
            rentalsByStatus: result.rentalsByStatus.map(
              ({ status, count }) => ({ status, count }),
            ),
          },
          sourceReferences: [
            { id: 'reports', label: 'Báo cáo vận hành', path: '/app/reports' },
          ],
          limitations: [
            'Doanh thu dựa trên các giao dịch đã ghi nhận. Tỷ lệ sử dụng là ước tính và tính cả thời gian đã giữ chỗ.',
          ],
          moreAvailable: false,
        };
      }
    }
  }
}
