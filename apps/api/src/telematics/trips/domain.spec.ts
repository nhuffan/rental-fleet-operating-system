import { randomUUID } from 'node:crypto';
import {
  associateRentals,
  decodeTripId,
  deriveTrips,
  distanceMeters,
  tripRange,
  type RecordedPoint,
} from './domain.js';
const now = new Date('2026-10-23T12:00:00Z');
const range = {
  from: '2026-10-23T10:00:00.000Z',
  to: '2026-10-23T12:00:00.000Z',
};
const vehicleId = randomUUID(),
  assignmentId = randomUUID(),
  deviceId = randomUUID();
const point = (
  minutes: number,
  extra: Partial<RecordedPoint> = {},
): RecordedPoint => ({
  id: randomUUID(),
  vehicleId,
  assignmentId,
  deviceId,
  licensePlate: 'TEST123',
  assignedAt: new Date('2026-10-23T09:00:00Z'),
  unassignedAt: null,
  recordedAt: new Date(now.getTime() - (60 - minutes) * 60000),
  receivedAt: new Date(now.getTime() - (60 - minutes) * 60000 + 100),
  latitude: 10.77,
  longitude: 106.7 + minutes * 0.0005,
  speedKph: 20,
  heading: 90,
  ignition: true,
  sourceMode: 'TEST',
  ...extra,
});
it('sorts delayed fixes by recorded time and canonicalizes equal-time duplicates to first receipt', () => {
  const a = point(0),
    b = point(1),
    c = point(2);
  const duplicate = {
    ...b,
    id: randomUUID(),
    receivedAt: new Date(b.receivedAt.getTime() + 1000),
    latitude: 20,
  };
  const first = deriveTrips([c, duplicate, a, b, b], range, [], now);
  const second = deriveTrips([b, a, c], range, [], now);
  expect(first[0].summary).toEqual(second[0].summary);
  expect(first[0].points.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
  expect(first[0].summary).toMatchObject({
    pointCount: 3,
    durationSeconds: 120,
    sourceMode: 'TEST',
    derivation: 'DERIVED',
    distanceKind: 'ESTIMATED',
    routeAvailable: true,
    partial: true,
  });
  expect(first[0].summary.distanceMeters).toBeGreaterThan(100);
  expect(first[0].summary.partialReasons).toEqual(
    expect.arrayContaining([
      'START_NOT_OBSERVED',
      'END_NOT_OBSERVED',
      'RANGE_START',
    ]),
  );
  expect(decodeTripId(first[0].summary.id, now)).toEqual({
    vehicleId,
    startId: a.id,
    range,
  });
});
it('splits gaps greater than ten minutes without estimating a line through missing history', () => {
  const trips = deriveTrips(
    [point(0), point(1), point(12), point(13)],
    range,
    [],
    now,
  );
  expect(trips).toHaveLength(2);
  expect(trips[0].summary.partialReasons).toContain('GAP_AFTER');
  expect(trips[1].summary.partialReasons).toContain('GAP_BEFORE');
  expect(
    trips.every(
      (t) => t.summary.distanceMeters < 100 && t.points[0].breakBefore,
    ),
  ).toBe(true);
});
it('preserves historical assignment boundaries even with the same vehicle and adjacent fixes', () => {
  const other = randomUUID();
  const trips = deriveTrips(
    [
      point(0),
      point(1),
      point(2, { assignmentId: other }),
      point(3, { assignmentId: other }),
    ],
    range,
    [],
    now,
  );
  expect(trips.map((t) => t.summary.assignmentId)).toEqual([
    assignmentId,
    other,
  ]);
  expect(trips[0].summary.partialReasons).toContain('ASSIGNMENT_BOUNDARY');
});
it('uses observed ignition stops and excludes stationary engine segments', () => {
  const trips = deriveTrips(
    [
      point(0, { ignition: false, speedKph: 0 }),
      point(1),
      point(2),
      point(3, { ignition: false, speedKph: 0 }),
    ],
    range,
    [],
    now,
  );
  expect(trips).toHaveLength(1);
  expect(trips[0].summary.partial).toBe(false);
  expect(trips[0].summary.pointCount).toBe(3);
  expect(
    deriveTrips(
      [point(0, { speedKph: 0 }), point(1, { longitude: 106.7, speedKph: 0 })],
      range,
      [],
      now,
    ),
  ).toEqual([]);
});
it('falls back to observed displacement with unknown ignition and never fabricates a route from one fix', () => {
  const trips = deriveTrips(
    [
      point(0, { ignition: null, speedKph: 0 }),
      point(1, { ignition: null, speedKph: 0 }),
    ],
    range,
    [],
    now,
  );
  expect(trips[0].summary.routeAvailable).toBe(true);
  const single = deriveTrips([point(0)], range, [], now)[0];
  expect(single.summary).toMatchObject({
    pointCount: 1,
    distanceMeters: 0,
    routeAvailable: false,
    partial: true,
  });
  expect(single.summary.partialReasons).toContain('INSUFFICIENT_POINTS');
});
it('breaks implausible jumps, omits their distance and records contradictory ignition', () => {
  const trip = deriveTrips(
    [point(0), point(1, { latitude: 30, ignition: false })],
    range,
    [],
    now,
  )[0];
  expect(trip.summary.distanceMeters).toBe(0);
  expect(trip.summary.routeAvailable).toBe(false);
  expect(trip.summary.partialReasons).toEqual(
    expect.arrayContaining([
      'POSITION_JUMP',
      'IGNITION_CONFLICT',
      'INSUFFICIENT_POINTS',
    ]),
  );
  expect(trip.points[1].breakBefore).toBe(true);
});
it('labels scheduled rental containment and overlap separately without implying confirmed customer use', () => {
  const [start, end] = [point(0).recordedAt, point(3).recordedAt];
  const rentals = [
    {
      id: 'contained',
      vehicleId,
      startAt: new Date(start.getTime() - 1),
      endAt: new Date(end.getTime() + 1),
    },
    {
      id: 'overlap',
      vehicleId,
      startAt: new Date(start.getTime() + 1),
      endAt: new Date(end.getTime() + 1),
    },
    {
      id: 'other',
      vehicleId: randomUUID(),
      startAt: start,
      endAt: new Date(end.getTime() + 1),
    },
    {
      id: 'adjacent',
      vehicleId,
      startAt: new Date(start.getTime() - 60000),
      endAt: start,
    },
  ];
  expect(associateRentals(vehicleId, start, end, rentals)).toEqual([
    { rentalId: 'contained', relation: 'CONTAINED', basis: 'SCHEDULED_WINDOW' },
    { rentalId: 'overlap', relation: 'OVERLAP', basis: 'SCHEDULED_WINDOW' },
  ]);
  expect(
    deriveTrips([point(0), point(3)], range, rentals, now)[0].summary.rentalId,
  ).toBeNull();
});
it('marks history across the received-time retention boundary as partial even if a latest fix survives', () => {
  const oldRange = {
    from: '2026-09-01T00:00:00.000Z',
    to: '2026-09-02T00:00:00.000Z',
  };
  const old = point(0, {
    recordedAt: new Date('2026-09-01T01:00:00Z'),
    assignedAt: new Date('2026-08-31T00:00:00Z'),
  });
  expect(
    deriveTrips([old], oldRange, [], now)[0].summary.partialReasons,
  ).toContain('RETENTION_WINDOW');
});
it('estimates great-circle distance and rejects unbounded/invalid windows and malformed ids', () => {
  expect(
    distanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ),
  ).toBeCloseTo(111194.927, 1);
  expect(tripRange(undefined, undefined, now)).toEqual({
    from: '2026-10-22T12:00:00.000Z',
    to: now.toISOString(),
  });
  for (const [from, to] of [
    ['bad', now.toISOString()],
    [now.toISOString(), now.toISOString()],
    ['2026-10-01T00:00:00Z', now.toISOString()],
    ['2026-10-23T12:00:00Z', '2026-10-23T13:00:00Z'],
  ])
    expect(() => tripRange(from, to, now)).toThrow();
  for (const id of [
    'bad',
    'x'.repeat(601),
    Buffer.from(
      JSON.stringify({
        v: 1,
        vehicleId,
        startId: randomUUID(),
        from: 'bad',
        to: range.to,
      }),
    ).toString('base64url'),
  ])
    expect(() => decodeTripId(id)).toThrow();
});

it('excludes fixes outside their historical assignment interval after future-clock-skew reassignment', () => {
  const end = point(1).recordedAt;
  const data = [
    point(0, { unassignedAt: end }),
    point(1, { unassignedAt: end }),
    point(2, { unassignedAt: end }),
    point(-1, { assignedAt: point(0).recordedAt }),
  ];
  const trips = deriveTrips(data, range, [], now);
  expect(trips).toHaveLength(1);
  expect(trips[0].summary.pointCount).toBe(1);
  expect(trips[0].summary.startedAt).toBe(point(0).recordedAt.toISOString());
});
