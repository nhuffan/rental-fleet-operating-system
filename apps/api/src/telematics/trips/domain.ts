import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type {
  TripPoint,
  TripRange,
  TripRentalAssociation,
  TripSummary,
} from './dto.js';
export const TRIP_MAX_RANGE_MS = 7 * 86400000;
export const TRIP_POINT_CAP = 10000;
export const TRIP_GAP_MS = 10 * 60000;
export const MOVEMENT_KPH = 3;
export const MOVEMENT_METERS = 30;
export const MAX_EDGE_KPH = 250;
export type RecordedPoint = {
  id: string;
  vehicleId: string;
  licensePlate: string;
  assignmentId: string;
  deviceId: string;
  assignedAt: Date;
  unassignedAt: Date | null;
  recordedAt: Date;
  receivedAt: Date;
  latitude: number;
  longitude: number;
  speedKph: number;
  heading: number;
  ignition: boolean | null;
  sourceMode: 'TEST';
};
export type RentalInterval = {
  id: string;
  vehicleId: string;
  startAt: Date;
  endAt: Date;
};
export type DerivedTrip = { summary: TripSummary; points: TripPoint[] };
export function tripRange(
  from?: string,
  to?: string,
  now = new Date(),
): TripRange {
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(end.getTime() - 86400000);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start ||
    end.getTime() - start.getTime() > TRIP_MAX_RANGE_MS ||
    end.getTime() > now.getTime() + 300000
  )
    throw new BadRequestException({
      code: 'INVALID_TRIP_RANGE',
      message:
        'Use an increasing UTC range of at most 7 days, ending no later than five minutes from now',
    });
  return { from: start.toISOString(), to: end.toISOString() };
}
export function distanceMeters(
  a: Pick<RecordedPoint, 'latitude' | 'longitude'>,
  b: Pick<RecordedPoint, 'latitude' | 'longitude'>,
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const lat = rad(b.latitude - a.latitude);
  const lon = rad(b.longitude - a.longitude);
  const x =
    Math.sin(lat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}
export function tripId(point: RecordedPoint, range: TripRange) {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      vehicleId: point.vehicleId,
      startId: point.id,
      from: range.from,
      to: range.to,
    }),
  ).toString('base64url');
}
export function decodeTripId(
  id: string,
  now = new Date(),
): { vehicleId: string; startId: string; range: TripRange } {
  try {
    if (!/^[A-Za-z0-9_-]{20,600}$/.test(id)) throw new Error();
    const data = JSON.parse(
      Buffer.from(id, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    if (
      data.v !== 1 ||
      !isUUID(data.vehicleId) ||
      !isUUID(data.startId) ||
      typeof data.from !== 'string' ||
      typeof data.to !== 'string'
    )
      throw new Error();
    const range = tripRange(data.from, data.to, now);
    if (range.from !== data.from || range.to !== data.to) throw new Error();
    return {
      vehicleId: data.vehicleId as string,
      startId: data.startId as string,
      range,
    };
  } catch {
    throw new BadRequestException({
      code: 'INVALID_TRIP_ID',
      message: 'Invalid derived trip identifier',
    });
  }
}
export function associateRentals(
  vehicleId: string,
  start: Date,
  end: Date,
  rentals: RentalInterval[],
): TripRentalAssociation[] {
  return rentals
    .filter(
      (r) => r.vehicleId === vehicleId && r.startAt <= end && r.endAt > start,
    )
    .map((r): TripRentalAssociation => ({
      rentalId: r.id,
      relation: r.startAt <= start && r.endAt > end ? 'CONTAINED' : 'OVERLAP',
      basis: 'SCHEDULED_WINDOW',
    }))
    .sort((a, b) => a.rentalId.localeCompare(b.rentalId));
}
// Segmentation always uses recorded time and the assignment stored at ingestion,
// never the current tracker assignment or packet arrival order.
export function deriveTrips(
  input: RecordedPoint[],
  range: TripRange,
  rentals: RentalInterval[],
  now = new Date(),
): DerivedTrip[] {
  const start = new Date(range.from),
    end = new Date(range.to);
  const ordered = input
    .filter(
      (p) =>
        p.recordedAt >= start &&
        p.recordedAt < end &&
        p.recordedAt >= p.assignedAt &&
        (!p.unassignedAt || p.recordedAt < p.unassignedAt),
    )
    .sort(
      (a, b) =>
        a.vehicleId.localeCompare(b.vehicleId) ||
        a.recordedAt.getTime() - b.recordedAt.getTime() ||
        a.receivedAt.getTime() - b.receivedAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  const seen = new Set<string>();
  const points = ordered.filter((p) => {
    const key = p.assignmentId + ':' + p.recordedAt.toISOString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const result: DerivedTrip[] = [];
  let active: RecordedPoint[] = [];
  let reasons: string[] = [];
  let previous: RecordedPoint | undefined;
  let afterObservedStop = false;
  const finish = (endReason?: string) => {
    if (!active.length) return;
    const first = active[0],
      last = active[active.length - 1];
    const localReasons = [...reasons, ...(endReason ? [endReason] : [])];
    let distance = 0,
      moving = active.some((p) => p.speedKph >= MOVEMENT_KPH),
      usableEdges = 0;
    const route = active.map((p, i): TripPoint => {
      let breakBefore = i === 0;
      if (i > 0) {
        const prev = active[i - 1];
        const elapsed = p.recordedAt.getTime() - prev.recordedAt.getTime();
        const edge = distanceMeters(prev, p);
        if (elapsed <= 0 || (edge / elapsed) * 3600 > MAX_EDGE_KPH) {
          breakBefore = true;
          localReasons.push('POSITION_JUMP');
        } else {
          distance += edge;
          usableEdges++;
          if (edge >= MOVEMENT_METERS) moving = true;
        }
      }
      return {
        id: p.id,
        recordedAt: p.recordedAt.toISOString(),
        receivedAt: p.receivedAt.toISOString(),
        latitude: p.latitude,
        longitude: p.longitude,
        speedKph: p.speedKph,
        heading: p.heading,
        ignition: p.ignition,
        sourceMode: p.sourceMode,
        breakBefore,
      };
    });
    if (moving) {
      if (!usableEdges) localReasons.push('INSUFFICIENT_POINTS');
      if (new Date(range.from).getTime() < now.getTime() - 30 * 86400000)
        localReasons.push('RETENTION_WINDOW');
      const uniqueReasons = [...new Set(localReasons)];
      const rentalAssociations = associateRentals(
        first.vehicleId,
        first.recordedAt,
        last.recordedAt,
        rentals,
      );
      const contained = rentalAssociations.filter(
        (r) => r.relation === 'CONTAINED',
      );
      const age = now.getTime() - last.recordedAt.getTime();
      result.push({
        summary: {
          id: tripId(first, range),
          vehicleId: first.vehicleId,
          licensePlate: first.licensePlate,
          assignmentId: first.assignmentId,
          deviceId: first.deviceId,
          rentalId:
            contained.length === 1 && rentalAssociations.length === 1
              ? contained[0].rentalId
              : null,
          rentalAssociations,
          startedAt: first.recordedAt.toISOString(),
          endedAt: last.recordedAt.toISOString(),
          durationSeconds: Math.max(
            0,
            Math.round(
              (last.recordedAt.getTime() - first.recordedAt.getTime()) / 1000,
            ),
          ),
          distanceMeters: Math.round(distance),
          pointCount: active.length,
          sourceMode: 'TEST',
          derivation: 'DERIVED',
          distanceKind: 'ESTIMATED',
          lastRecordedAt: last.recordedAt.toISOString(),
          lastReceivedAt: new Date(
            Math.max(...active.map((p) => p.receivedAt.getTime())),
          ).toISOString(),
          freshness:
            age <= 120000 ? 'FRESH' : age <= 600000 ? 'STALE' : 'OFFLINE',
          partial: uniqueReasons.length > 0,
          partialReasons: uniqueReasons,
          routeAvailable: usableEdges > 0,
          range,
        },
        points: route,
      });
    }
    active = [];
    reasons = [];
  };
  for (const p of points) {
    const different =
      previous &&
      (previous.vehicleId !== p.vehicleId ||
        previous.assignmentId !== p.assignmentId);
    const gap =
      previous &&
      p.recordedAt.getTime() - previous.recordedAt.getTime() > TRIP_GAP_MS;
    if (different || gap) {
      finish(
        different
          ? previous?.vehicleId === p.vehicleId
            ? 'ASSIGNMENT_BOUNDARY'
            : 'END_NOT_OBSERVED'
          : 'GAP_AFTER',
      );
      afterObservedStop = false;
    }
    const stop = p.ignition === false && p.speedKph < MOVEMENT_KPH;
    if (stop) {
      if (active.length) {
        active.push(p);
        finish();
      }
      afterObservedStop = true;
    } else {
      if (!active.length) {
        reasons = afterObservedStop
          ? []
          : [gap && !different ? 'GAP_BEFORE' : 'START_NOT_OBSERVED'];
        if (!afterObservedStop && p.assignedAt < start)
          reasons.push('RANGE_START');
      }
      if (p.ignition === false) reasons.push('IGNITION_CONFLICT');
      active.push(p);
      afterObservedStop = false;
    }
    previous = p;
  }
  finish('END_NOT_OBSERVED');
  return result;
}
