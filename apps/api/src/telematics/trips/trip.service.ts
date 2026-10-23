import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { TenantContext } from '../../auth/guards.js';
import { Database } from '../../database/database.js';
import {
  TripQuery,
  TripRouteQuery,
  type TripPage,
  type TripRoutePage,
} from './dto.js';
import {
  decodeTripId,
  deriveTrips,
  tripRange,
  TRIP_POINT_CAP,
  type DerivedTrip,
  type RecordedPoint,
  type RentalInterval,
} from './domain.js';
const missing = () =>
  new NotFoundException({
    code: 'TRIP_NOT_FOUND',
    message: 'Trip or filter resource not found in this business',
  });
@Injectable()
export class TripService {
  constructor(@Inject(Database) private readonly database: Database) {}
  private async derive(
    c: TenantContext,
    q: TripQuery,
  ): Promise<{
    trips: DerivedTrip[];
    range: { from: string; to: string };
    now: Date;
  }> {
    const now = new Date();
    const range = tripRange(q.from, q.to, now);
    let vehicleId = q.vehicleId;
    if (q.rentalId) {
      const rental = await this.database.pool.query<{ vehicle_id: string }>(
        'select vehicle_id from public.rentals where business_id=$1 and id=$2',
        [c.businessId, q.rentalId],
      );
      if (
        !rental.rows[0] ||
        (vehicleId && vehicleId !== rental.rows[0].vehicle_id)
      )
        throw missing();
      vehicleId = rental.rows[0].vehicle_id;
    }
    if (vehicleId) {
      const vehicle = await this.database.pool.query(
        'select id from public.vehicles where business_id=$1 and id=$2',
        [c.businessId, vehicleId],
      );
      if (!vehicle.rows[0]) throw missing();
    }
    const candidates = await this.database.pool.query<RecordedPoint>(
      `
      select p.id,p.vehicle_id as "vehicleId",v.license_plate as "licensePlate",p.assignment_id as "assignmentId",p.device_id as "deviceId",
        a.assigned_at as "assignedAt",a.unassigned_at as "unassignedAt",p.recorded_at as "recordedAt",p.received_at as "receivedAt",
        p.latitude,p.longitude,p.speed_kph as "speedKph",p.heading,p.ignition,p.source_mode as "sourceMode"
      from public.gps_positions p
      join public.vehicles v on v.business_id=p.business_id and v.id=p.vehicle_id
      join public.device_assignments a on a.business_id=p.business_id and a.id=p.assignment_id and a.vehicle_id=p.vehicle_id and a.device_id=p.device_id
      where p.business_id=$1 and ($2::uuid is null or p.vehicle_id=$2) and p.recorded_at>=$3 and p.recorded_at<$4 and p.recorded_at>=a.assigned_at and (a.unassigned_at is null or p.recorded_at<a.unassigned_at)
      order by p.recorded_at,p.received_at,p.id limit $5`,
      [
        c.businessId,
        vehicleId ?? null,
        range.from,
        range.to,
        TRIP_POINT_CAP + 1,
      ],
    );
    if (candidates.rows.length > TRIP_POINT_CAP)
      throw new UnprocessableEntityException({
        code: 'TRIP_POINT_LIMIT',
        message:
          'More than 10000 candidate fixes; narrow the vehicle or date range',
      });
    const vehicleIds = [...new Set(candidates.rows.map((p) => p.vehicleId))];
    const rentals = vehicleIds.length
      ? await this.database.pool.query<RentalInterval>(
          `
      select id,vehicle_id as "vehicleId",start_at as "startAt",end_at as "endAt" from public.rentals
      where business_id=$1 and vehicle_id=any($2::uuid[]) and status in ('RESERVED','ACTIVE','COMPLETED') and start_at<$4 and end_at>$3`,
          [c.businessId, vehicleIds, range.from, range.to],
        )
      : { rows: [] };
    const trips = deriveTrips(candidates.rows, range, rentals.rows, now).filter(
      (t) =>
        !q.rentalId ||
        t.summary.rentalAssociations.some((r) => r.rentalId === q.rentalId),
    );
    trips.sort(
      (a, b) =>
        a.summary.startedAt.localeCompare(b.summary.startedAt) ||
        a.summary.id.localeCompare(b.summary.id),
    );
    if (q.sort !== 'asc') trips.reverse();
    return { trips, range, now };
  }
  async list(c: TenantContext, q: TripQuery): Promise<TripPage> {
    const { trips, range, now } = await this.derive(c, q);
    return {
      data: trips
        .slice((q.page - 1) * q.limit, q.page * q.limit)
        .map((t) => t.summary),
      page: q.page,
      limit: q.limit,
      total: trips.length,
      range,
      retentionDays: 30,
      retentionBoundaryAt: new Date(
        now.getTime() - 30 * 86400000,
      ).toISOString(),
      candidatePointLimit: TRIP_POINT_CAP,
    };
  }
  private async resolve(c: TenantContext, id: string) {
    const decoded = decodeTripId(id);
    const q = Object.assign(new TripQuery(), {
      vehicleId: decoded.vehicleId,
      from: decoded.range.from,
      to: decoded.range.to,
    });
    const { trips } = await this.derive(c, q);
    const trip = trips.find((t) => t.summary.id === id);
    if (!trip) throw missing();
    return trip;
  }
  async get(c: TenantContext, id: string) {
    return (await this.resolve(c, id)).summary;
  }
  async route(
    c: TenantContext,
    id: string,
    q: TripRouteQuery,
  ): Promise<TripRoutePage> {
    const trip = await this.resolve(c, id);
    return {
      tripId: trip.summary.id,
      data: trip.points.slice((q.page - 1) * q.limit, q.page * q.limit),
      page: q.page,
      limit: q.limit,
      total: trip.points.length,
      hasMore: q.page * q.limit < trip.points.length,
      distanceKind: 'ESTIMATED',
      partial: trip.summary.partial,
      partialReasons: trip.summary.partialReasons,
    };
  }
}
