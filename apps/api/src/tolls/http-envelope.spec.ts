import 'reflect-metadata';
import {
  Body,
  Controller,
  Module,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { gzipSync } from 'node:zlib';
import { configureApp } from '../http.js';
import { GpsIngress } from '../telematics/gps/ingress.js';
vi.mock('../config.js', () => ({
  loadConfig: () => ({
    origin: 'http://localhost:4000',
    environment: 'test',
    rateLimitPerMinute: 300,
    trustProxy: false,
  }),
}));
@Controller('tolls/imports')
class ProbeController {
  @Post('preview') preview(@Body() body: { csv: string }) {
    return { bytes: Buffer.byteLength(body.csv, 'utf8') };
  }
}
@Module({
  controllers: [ProbeController],
  providers: [
    {
      provide: GpsIngress,
      useValue: {
        middleware: () => (_req: unknown, _res: unknown, next: () => void) =>
          next(),
      },
    },
  ],
})
class ProbeModule {}
let app: INestApplication;
const previousLogging = process.env.LOG_REQUESTS;
beforeAll(async () => {
  process.env.LOG_REQUESTS = 'false';
  app = await NestFactory.create(ProbeModule, { logger: false });
  configureApp(app);
  await app.init();
});
afterAll(async () => {
  await app?.close();
  if (previousLogging === undefined) delete process.env.LOG_REQUESTS;
  else process.env.LOG_REQUESTS = previousLogging;
});
it('accepts a 64 KiB CSV with JSON escaping beyond the default parser envelope limit', async () => {
  const csv = '"'.repeat(64 * 1024);
  const response = await request(app.getHttpServer())
    .post('/api/v1/tolls/imports/preview')
    .send({ csv })
    .expect(201);
  expect(response.body.bytes).toBe(65536);
});
it('rejects oversized envelopes and malformed JSON with safe public errors', async () => {
  const large = await request(app.getHttpServer())
    .post('/api/v1/tolls/imports/preview')
    .send({ csv: 'x'.repeat(256 * 1024) })
    .expect(413);
  expect(large.body.code).toBe('TOLL_CSV_TOO_LARGE');
  const invalid = await request(app.getHttpServer())
    .post('/api/v1/tolls/imports/preview')
    .set('Content-Type', 'application/json')
    .send('{"csv":')
    .expect(400);
  expect(invalid.body.code).toBe('TOLL_CSV_INVALID');
});
it('rejects compressed imports rather than decompressing an unbounded file', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/tolls/imports/preview')
    .set('Content-Type', 'application/json')
    .set('Content-Encoding', 'gzip')
    .send(gzipSync('{"csv":"test"}'))
    .expect(415);
});
