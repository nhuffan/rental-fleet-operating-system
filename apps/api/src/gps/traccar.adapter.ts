import { isISO8601 } from 'class-validator';
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
export const FRESH_SECONDS = 120;
export const OFFLINE_SECONDS = 600;
export const HISTORY_DAYS = 30;
export type GpsState = 'FRESH' | 'STALE' | 'OFFLINE' | 'NO_DATA' | 'UNASSIGNED';
export type NormalizedTelemetry = {
  provider: 'traccar';
  deviceUid: string;
  recordedAt: Date;
  receivedAt: Date;
  latitude: number;
  longitude: number;
  speedKph: number;
  heading: number;
  ignition: boolean | null;
  sourceEventId: string | null;
  eventKey: string;
  sourceMode: 'TEST';
};
const invalid = () =>
  new BadRequestException({
    code: 'INVALID_TELEMETRY',
    message: 'Invalid GPS position',
  });
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid();
  return v as Record<string, unknown>;
}
export function authenticateTraccar(token: string | undefined) {
  const expected = process.env.GPS_TRACCAR_TOKEN;
  if (!expected || expected.length < 32)
    throw new ServiceUnavailableException({
      code: 'GPS_NOT_CONFIGURED',
      message: 'GPS ingestion is disabled',
    });
  const hash = (s: string) => createHash('sha256').update(s).digest();
  if (!token || !timingSafeEqual(hash(token), hash(expected)))
    throw new UnauthorizedException({
      code: 'INVALID_GPS_TOKEN',
      message: 'GPS authentication failed',
    });
}
/** Traccar JSON forwarding contract. Ignore provider enrichment, never persist raw packets.
 * Position.speed is knots. Forwarder memory-store IDs restart; semantic hash is the
 * idempotency identity, while the upstream ID is retained only as diagnostic metadata. */
export function normalizeTraccar(body: unknown): NormalizedTelemetry {
  const root = object(body),
    p = object(root.position),
    d = object(root.device);
  if (
    typeof d.uniqueId !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(d.uniqueId) ||
    p.valid !== true
  )
    throw invalid();
  if (
    typeof p.fixTime !== 'string' ||
    !isISO8601(p.fixTime, { strict: true, strictSeparator: true }) ||
    !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(p.fixTime)
  )
    throw invalid();
  const recordedAt = new Date(p.fixTime);
  const number = (value: unknown, min: number, max: number) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    )
      throw invalid();
    return value;
  };
  if (!Number.isFinite(recordedAt.getTime())) throw invalid();
  const attributes = p.attributes === undefined ? {} : object(p.attributes);
  if (
    attributes.ignition !== undefined &&
    typeof attributes.ignition !== 'boolean'
  )
    throw invalid();
  const latitude = number(p.latitude, -90, 90),
    longitude = number(p.longitude, -180, 180);
  const speedKph = number(p.speed, 0, 600 / 1.852) * 1.852,
    heading = number(p.course, 0, 359.999999999);
  const ignition =
    typeof attributes.ignition === 'boolean' ? attributes.ignition : null;
  const sourceEventId =
    Number.isSafeInteger(p.id) && Number(p.id) > 0 ? String(p.id) : null;
  const eventKey = createHash('sha256')
    .update(
      JSON.stringify([
        d.uniqueId,
        recordedAt.toISOString(),
        latitude,
        longitude,
        speedKph,
        heading,
        ignition,
      ]),
    )
    .digest('hex');
  return {
    provider: 'traccar',
    deviceUid: d.uniqueId,
    recordedAt,
    receivedAt: new Date(),
    latitude,
    longitude,
    speedKph,
    heading,
    ignition,
    sourceEventId,
    eventKey,
    sourceMode: 'TEST',
  };
}
export function freshness(
  assigned: boolean,
  recordedAt: Date | null,
  now: Date,
): GpsState {
  if (!assigned) return 'UNASSIGNED';
  if (!recordedAt) return 'NO_DATA';
  const age = (now.getTime() - recordedAt.getTime()) / 1000;
  return age <= FRESH_SECONDS
    ? 'FRESH'
    : age <= OFFLINE_SECONDS
      ? 'STALE'
      : 'OFFLINE';
}
