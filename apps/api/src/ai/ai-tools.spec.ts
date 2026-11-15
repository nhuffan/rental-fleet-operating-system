import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AlertsService } from '../alerts/alerts.service.js';
import type { TenantContext } from '../auth/guards.js';
import type { Database } from '../database/database.js';
import type { FleetService } from '../fleet/vehicles/fleet.service.js';
import type { RentalService } from '../rentals/rental.service.js';
import type { ReportsService } from '../reports/reports.service.js';
import { AiTools } from './ai-tools.js';

const vehicleId = '20000000-0000-4000-8000-000000000001';
const owner: TenantContext = {
  role: 'OWNER',
  businessId: '20000000-0000-4000-8000-000000000002',
  membershipId: '20000000-0000-4000-8000-000000000003',
  userId: '20000000-0000-4000-8000-000000000004',
  businessName: 'Synthetic business',
  email: 'owner@example.invalid',
};
const plate = '51A00001';
const from = '2026-10-15T00:00:00.000Z';
const until = '2026-11-14T00:00:00.000Z';

function fixture(active = true) {
  const limit = vi
    .fn()
    .mockResolvedValue(active ? [{ id: owner.membershipId }] : []);
  const builder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit,
  };
  const list = vi.fn();
  const vehicle = vi.fn();
  const availability = vi.fn();
  const listRentals = vi.fn();
  const summary = vi.fn();
  const tools = new AiTools(
    { db: builder } as unknown as Database,
    { list } as unknown as AlertsService,
    { vehicle } as unknown as FleetService,
    { availability, listRentals } as unknown as RentalService,
    { summary } as unknown as ReportsService,
  );
  return { tools, list, vehicle, availability, listRentals, summary };
}

describe('AI operational tools', () => {
  it('denies non-Owner and revoked memberships before domain access', async () => {
    const { tools, summary } = fixture(false);
    for (const role of ['OWNER', 'CUSTOMER', 'PLATFORM_OPERATOR', 'ADMIN']) {
      await expect(
        tools.execute({ ...owner, role }, 'get_business_report', {}),
      ).rejects.toMatchObject({ code: 'AI_TOOL_DENIED' });
    }
    expect(summary).not.toHaveBeenCalled();
  });

  it('keeps GPS TEST observations without exposing the derived assignment ID', async () => {
    const { tools, list } = fixture();
    list.mockResolvedValue({
      asOf: until,
      data: [
        {
          id: 'GPS_STALE:assignment-secret',
          kind: 'GPS_STALE',
          severity: 'WARNING',
          sourceMode: 'TEST',
          gpsState: 'STALE',
          vehicleId,
          licensePlate: plate,
          rentalId: null,
          dueAt: null,
          lastSeenAt: from,
        },
      ],
      stats: { total: 42 },
      rules: { dueSoonSeconds: 86400 },
      page: 1,
      limit: 10,
      total: 11,
    });
    const result = await tools.execute(owner, 'get_operational_alerts', {
      kind: 'GPS_STALE',
    });
    expect(list).toHaveBeenCalledWith(owner, {
      kind: 'GPS_STALE',
      page: 1,
      limit: 10,
    });
    expect(result).toMatchObject({
      asOf: until,
      moreAvailable: true,
      data: { total: 11, items: [{ sourceMode: 'TEST', vehicleId }] },
      sourceReferences: [
        { path: '/app/alerts?kind=GPS_STALE' },
        { path: `/app/vehicles/${vehicleId}` },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('assignment-secret');
  });

  it('preserves recorded VND strings and strips raw detail from report results', async () => {
    const { tools, summary } = fixture();
    summary.mockResolvedValue({
      currency: 'VND',
      basis: 'RECORDED_MOVEMENTS',
      from,
      until,
      recordedRevenue: '9007199254740993',
      cashReceived: '9007199254740993',
      operatingExpenses: '0',
      estimatedProfit: '9007199254740993',
      depositHeld: '0',
      fleetUtilizationPercent: 20.1,
      activeVehicles: 2,
      rentalsByStatus: [{ status: 'ACTIVE', count: 1 }],
      vehicles: [{ hidden: 'donotexpose-private-detail' }],
      months: [],
    });
    const result = await tools.execute(owner, 'get_business_report', {});
    expect(result.data).toMatchObject({ recordedRevenue: '9007199254740993' });
    expect(result.asOf).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('donotexpose');
  });

  it('rejects customer search, foreign tenant selectors and out-of-bounds dates', async () => {
    const { tools, listRentals, availability } = fixture();
    for (const input of [
      { search: 'x@example.invalid' },
      { businessId: vehicleId },
    ]) {
      await expect(
        tools.execute(owner, 'get_rental_overview', input),
      ).rejects.toMatchObject({ code: 'AI_TOOL_INVALID_INPUT' });
    }
    await expect(
      tools.execute(owner, 'get_vehicle_availability', {
        startAt: '2026-11-01T00:00:00+07:00',
        endAt: '2027-03-01T00:00:00+07:00',
      }),
    ).rejects.toMatchObject({ code: 'AI_TOOL_INVALID_INPUT' });
    expect(listRentals).not.toHaveBeenCalled();
    expect(availability).not.toHaveBeenCalled();
  });

  it('passes a known UUID to scoped service and sanitizes domain errors', async () => {
    const { tools, vehicle } = fixture();
    vehicle.mockRejectedValue(new NotFoundException('Internal vehicle detail'));
    await expect(
      tools.execute(owner, 'get_vehicle_details', { vehicleId }),
    ).rejects.toMatchObject({
      code: 'AI_TOOL_NOT_FOUND',
      message: 'Requested resource not found',
    });
    expect(vehicle).toHaveBeenCalledWith(owner, vehicleId);
  });
});
