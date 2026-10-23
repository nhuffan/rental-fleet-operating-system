import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Module,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { configureApp } from '../../http.js';
import { TraccarController } from './gps.controller.js';
import { GpsService } from './gps.service.js';
import { GpsIngress, GPS_INGRESS_LIMITS } from './ingress.js';
import type { NormalizedTelemetry } from './traccar.adapter.js';
vi.mock('../../config.js', () => ({
  loadConfig: () => ({ environment: 'test', origin: 'http://localhost:4000' }),
}));
const ingest = vi.fn(async (_event: NormalizedTelemetry) => ({
  positionId: randomUUID(),
  duplicate: false,
}));
@Controller('ingress-test')
class UnrelatedController {
  @Post() echo(@Body() body: { padding: string }) {
    return { length: body.padding.length };
  }
}
@Module({
  controllers: [TraccarController, UnrelatedController],
  providers: [GpsIngress, { provide: GpsService, useValue: { ingest } }],
})
class IngressTestModule {}
let app: INestApplication;
const token = 'stage7-unit-secret-' + 'x'.repeat(48);
const originalToken = process.env.GPS_TRACCAR_TOKEN,
  originalLogging = process.env.LOG_REQUESTS;
const packet = () => ({
  device: { uniqueId: 'TEST-http-' + randomUUID() },
  position: {
    valid: true,
    fixTime: new Date().toISOString(),
    latitude: 10.77,
    longitude: 106.7,
    speed: 10,
    course: 90,
    attributes: { ignition: true },
  },
});
beforeEach(async () => {
  // Keep fixed-window quotas deterministic without faking HTTP timers.
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-23T00:00:01Z'));
  process.env.GPS_TRACCAR_TOKEN = token;
  process.env.LOG_REQUESTS = 'false';
  ingest.mockClear();
  app = await NestFactory.create(IngressTestModule, { logger: false });
  configureApp(app);
  await app.init();
});
afterEach(async () => {
  await app?.close();
  vi.restoreAllMocks();
  if (originalToken === undefined) delete process.env.GPS_TRACCAR_TOKEN;
  else process.env.GPS_TRACCAR_TOKEN = originalToken;
  if (originalLogging === undefined) delete process.env.LOG_REQUESTS;
  else process.env.LOG_REQUESTS = originalLogging;
});
const post = (secret = token) =>
  request(app.getHttpServer())
    .post('/api/v1/integrations/traccar/positions')
    .set('X-Traccar-Token', secret);
it('rejects credentials before parsing an oversized or malformed secret-bearing payload', async () => {
  const result = await post('wrong-secret')
    .set('Content-Type', 'application/json')
    .send('{"private":"' + 'x'.repeat(20000))
    .expect(401);
  expect(result.body).toMatchObject({
    code: 'INVALID_GPS_TOKEN',
    message: 'GPS authentication failed',
  });
  expect(result.body.requestId).toMatch(/^[a-f\d-]{36}$/);
  expect(ingest).not.toHaveBeenCalled();
  expect(JSON.stringify(result.body)).not.toContain('wrong-secret');
});
it('returns safe 413 and malformed-JSON 400 envelopes with request IDs', async () => {
  const large = await post()
    .send({ private: token, padding: 'x'.repeat(20000) })
    .expect(413);
  expect(large.body).toMatchObject({
    code: 'GPS_BODY_TOO_LARGE',
    message: 'GPS JSON exceeds the 16 KiB limit',
  });
  expect(large.body.requestId).toBe(large.headers['x-request-id']);
  const invalid = await post()
    .set('Content-Type', 'application/json')
    .send('{"private":"' + token + '",broken')
    .expect(400);
  expect(invalid.body.code).toBe('INVALID_GPS_JSON');
  expect(JSON.stringify([large.body, invalid.body])).not.toContain(token);
  expect(ingest).not.toHaveBeenCalled();
});
it('rejects compressed/non-JSON payloads and validates canonical fields before database access', async () => {
  await post().set('Content-Type', 'text/plain').send('secret').expect(415);
  await post().set('Content-Encoding', 'gzip').send(packet()).expect(415);
  await post()
    .send({ device: { uniqueId: 'x' } })
    .expect(400);
  expect(ingest).not.toHaveBeenCalled();
});
it('enforces per-device replay limits with a bounded Retry-After and TEST source', async () => {
  const body = packet();
  for (let i = 0; i < GPS_INGRESS_LIMITS.deviceRequests; i++)
    await post().send(body).expect(201);
  const blocked = await post().send(body).expect(429);
  expect(blocked.body.code).toBe('GPS_RATE_LIMITED');
  expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(60);
  expect(blocked.body).not.toHaveProperty('retryAfter');
  expect(ingest).toHaveBeenCalledTimes(GPS_INGRESS_LIMITS.deviceRequests);
  expect(ingest.mock.calls[0][0]).toMatchObject({
    provider: 'traccar',
    sourceMode: 'TEST',
  });
  await post().send(packet()).expect(201);
});

it('keeps the GPS cap scoped to its webhook rather than other JSON routes', async () => {
  const result = await request(app.getHttpServer())
    .post('/api/v1/ingress-test')
    .send({ padding: 'x'.repeat(20000) })
    .expect(201);
  expect(result.body.length).toBe(20000);
});
