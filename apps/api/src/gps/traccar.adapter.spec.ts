import {
  authenticateTraccar,
  freshness,
  normalizeTraccar,
} from './traccar.adapter.js';
const time = new Date('2026-10-22T12:00:00Z');
const packet = () => ({
  device: { uniqueId: 'TEST-stage5', name: 'extra provider enrichment' },
  position: {
    id: 22,
    fixTime: time.toISOString(),
    valid: true,
    latitude: 10.77,
    longitude: 106.7,
    speed: 10,
    course: 90,
    attributes: { ignition: true, unneeded: 'never stored' },
  },
});
it('normalizes only canonical fields and converts knots to km/h', () => {
  const e = normalizeTraccar(packet());
  expect(e.speedKph).toBe(18.52);
  expect(e.sourceMode).toBe('TEST');
  expect(e.ignition).toBe(true);
  expect(e.sourceEventId).toBe('22');
  expect(e).not.toHaveProperty('attributes');
  expect(e.receivedAt).toBeInstanceOf(Date);
});
it('deduplicates semantic retransmissions even if forwarder in-memory IDs restart', () => {
  const a = packet(),
    b = packet();
  b.position.id = 1;
  expect(normalizeTraccar(a).eventKey).toBe(normalizeTraccar(b).eventKey);
  b.position.latitude = 11;
  expect(normalizeTraccar(a).eventKey).not.toBe(normalizeTraccar(b).eventKey);
});
it.each([
  null,
  {},
  { position: {} },
  { ...packet(), device: { uniqueId: 'tenant/escape' } },
  { ...packet(), position: { ...packet().position, valid: false } },
  { ...packet(), position: { ...packet().position, latitude: 91 } },
  { ...packet(), position: { ...packet().position, longitude: NaN } },
  { ...packet(), position: { ...packet().position, speed: -1 } },
  { ...packet(), position: { ...packet().position, course: 360 } },
  { ...packet(), position: { ...packet().position, fixTime: '2026-10-22' } },
  {
    ...packet(),
    position: { ...packet().position, attributes: { ignition: 'true' } },
  },
])('rejects malformed packet %#', (value) => {
  expect(() => normalizeTraccar(value)).toThrow();
});
it('computes freshness from recordedAt rather than registration or arrival', () => {
  expect(freshness(false, time, time)).toBe('UNASSIGNED');
  expect(freshness(true, null, time)).toBe('NO_DATA');
  for (const [seconds, state] of [
    [0, 'FRESH'],
    [120, 'FRESH'],
    [121, 'STALE'],
    [600, 'STALE'],
    [601, 'OFFLINE'],
  ] as const)
    expect(
      freshness(true, new Date(time.getTime() - seconds * 1000), time),
    ).toBe(state);
});
it('fails closed without configuration and compares secret header', () => {
  const original = process.env.GPS_TRACCAR_TOKEN;
  try {
    delete process.env.GPS_TRACCAR_TOKEN;
    expect(() => authenticateTraccar('x')).toThrow();
    process.env.GPS_TRACCAR_TOKEN = 'a'.repeat(64);
    expect(() => authenticateTraccar(undefined)).toThrow();
    expect(() => authenticateTraccar('wrong')).toThrow();
    expect(() => authenticateTraccar('a'.repeat(64))).not.toThrow();
  } finally {
    if (original === undefined) delete process.env.GPS_TRACCAR_TOKEN;
    else process.env.GPS_TRACCAR_TOKEN = original;
  }
});
