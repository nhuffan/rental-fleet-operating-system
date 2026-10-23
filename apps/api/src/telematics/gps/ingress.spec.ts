import 'reflect-metadata';
import { GpsIngress, GPS_INGRESS_LIMITS } from './ingress.js';
import { HttpException } from '@nestjs/common';
const originalLogging = process.env.LOG_REQUESTS;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T00:00:01Z'));
  process.env.LOG_REQUESTS = 'false';
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalLogging === undefined) delete process.env.LOG_REQUESTS;
  else process.env.LOG_REQUESTS = originalLogging;
});
function limited(call: () => unknown) {
  try {
    call();
    throw new Error('Expected rate limit');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'GPS_RATE_LIMITED',
      retryAfter: 59,
    });
  }
}
it('caps process requests and resets the fixed window without retaining old UID buckets', () => {
  const ingress = new GpsIngress();
  for (let i = 0; i < GPS_INGRESS_LIMITS.globalRequests; i++)
    ingress.reserveRequest()();
  limited(() => ingress.reserveRequest());
  vi.setSystemTime(new Date('2026-10-23T00:01:01Z'));
  expect(() => ingress.reserveRequest()()).not.toThrow();
});
it('bounds concurrency and makes finish/close release idempotent', () => {
  const ingress = new GpsIngress();
  const releases = Array.from(
    { length: GPS_INGRESS_LIMITS.concurrentRequests },
    () => ingress.reserveRequest(),
  );
  limited(() => ingress.reserveRequest());
  releases[0]();
  releases[0]();
  const last = ingress.reserveRequest();
  limited(() => ingress.reserveRequest());
  last();
  releases.slice(1).forEach((release) => release());
  expect(() => ingress.reserveRequest()()).not.toThrow();
});
it('limits per-device replay without preventing another device, then releases quota next minute', () => {
  const ingress = new GpsIngress();
  for (let i = 0; i < GPS_INGRESS_LIMITS.deviceRequests; i++)
    ingress.consumeDevice('traccar', 'sensitive-device');
  limited(() => ingress.consumeDevice('traccar', 'sensitive-device'));
  expect(() =>
    ingress.consumeDevice('traccar', 'another-device'),
  ).not.toThrow();
  vi.setSystemTime(new Date('2026-10-23T00:01:01Z'));
  expect(() =>
    ingress.consumeDevice('traccar', 'sensitive-device'),
  ).not.toThrow();
});
it('bounds unknown UID cardinality without evicting an existing legitimate bucket', () => {
  const ingress = new GpsIngress();
  for (let i = 0; i < GPS_INGRESS_LIMITS.trackedDevices; i++)
    ingress.consumeDevice('traccar', 'unknown-' + i);
  limited(() => ingress.consumeDevice('traccar', 'overflow-identity'));
  expect(() => ingress.consumeDevice('traccar', 'unknown-0')).not.toThrow();
});
it('emits only fixed aggregate failure categories, never raw identities or event payloads', () => {
  process.env.LOG_REQUESTS = 'true';
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const ingress = new GpsIngress();
  ingress.consumeDevice('traccar', 'sensitive-device');
  ingress.record('authenticationRejected');
  ingress.record('invalidPayload');
  ingress.record('accepted');
  vi.setSystemTime(new Date('2026-10-23T00:01:01Z'));
  ingress.record('duplicate');
  expect(log).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(String(log.mock.calls[0][0]));
  expect(payload).toMatchObject({
    event: 'gps_ingress_window',
    sourceMode: 'TEST',
    counts: { authenticationRejected: 1, invalidPayload: 1, accepted: 1 },
  });
  expect(Object.keys(payload).sort()).toEqual([
    'counts',
    'event',
    'sourceMode',
    'windowSeconds',
  ]);
  expect(JSON.stringify(payload)).not.toContain('sensitive-device');
});
