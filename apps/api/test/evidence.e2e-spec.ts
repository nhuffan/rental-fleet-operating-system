import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import sharp from 'sharp';
import { disposableFixture } from './disposable-fixture.js';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/http.js';
import { Database } from '../dist/database/database.js';
import { loadConfig } from '../dist/config.js';
import { MediaInspector } from '../dist/evidence/media-inspector.js';

const fixture = disposableFixture({ includeCustomer: true });
const owned = fixture.data;
let app: INestApplication | undefined;
let database: Database | undefined;
let attached = false;
const inspection = {
  fuelPercent: 80,
  exteriorCondition: 'GOOD',
  interiorCondition: 'GOOD',
  spareTire: 'PRESENT',
  tools: 'NOT_APPLICABLE',
  registrationDocument: 'PRESENT',
  insuranceDocument: 'PRESENT',
  keys: 'PRESENT',
};
type Upload = {
  id: string;
  bucket: string;
  objectKey: string;
  token: string;
  signedUrl: string;
};
function api(actor = 'ownerA', business = owned.businessA) {
  if (!app) throw new Error('Evidence test app is unavailable');
  const headers = {
    Authorization: 'Bearer ' + fixture.tokens[actor],
    'X-Business-Id': business,
  };
  return {
    get: (path: string) =>
      request(app!.getHttpServer())
        .get('/api/v1' + path)
        .set(headers),
    post: (path: string, body: object) =>
      request(app!.getHttpServer())
        .post('/api/v1' + path)
        .set(headers)
        .send(body),
  };
}
async function syntheticVideo() {
  const binary: unknown = createRequire(import.meta.url)('ffmpeg-static');
  if (typeof binary !== 'string')
    throw new Error('Synthetic video encoder unavailable');
  const directory = await mkdtemp(join(tmpdir(), 'rental-evidence-live-'));
  try {
    const path = join(directory, 'clip.mp4');
    const encoded = spawnSync(
      binary,
      [
        '-nostdin',
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=orange:s=160x120:r=2:d=1',
        '-an',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-threads',
        '1',
        '-y',
        path,
      ],
      { timeout: 20_000, maxBuffer: 256 * 1024 },
    );
    if (encoded.status !== 0)
      throw new Error('Synthetic video encoding failed');
    return await readFile(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
async function privateFetch(url: string, init?: RequestInit) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    // Native fetch errors may include signed capability URLs in their cause.
    throw new Error('Private Storage request failed');
  }
}
beforeAll(async () => {
  process.env.LOG_REQUESTS = 'false';
  await fixture.start();
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  database = app.get(Database);
}, 120_000);
afterAll(async () => {
  try {
    // The shared fixture removes every owned Auth identity and membership, but
    // preserves immutable snapshots/evidence and still-live upload capabilities
    // under disabled tenant tombstones. Never delete objects before their hold.
    await fixture.cleanup();
    if (database && attached) {
      const retained = await database.pool.query<{
        status: string;
        evidence: number;
        snapshots: number;
        memberships: number;
      }>(
        `select b.status,
          (select count(*)::int from public.inspection_evidence e where e.business_id=b.id) evidence,
          (select count(*)::int from public.rental_inspections i where i.business_id=b.id) snapshots,
          (select count(*)::int from public.business_memberships m where m.business_id=b.id) memberships
        from public.businesses b where b.id=$1`,
        [owned.businessA],
      );
      expect(retained.rows).toEqual([
        { status: 'DISABLED', evidence: 2, snapshots: 1, memberships: 0 },
      ]);
      const identities = await database.pool.query<{ remaining: number }>(
        'select count(*)::int remaining from auth.users where id=any($1::uuid[])',
        [Object.values(owned.accounts).map((account) => account.id)],
      );
      expect(identities.rows[0].remaining).toBe(0);
    }
  } finally {
    await app?.close();
  }
}, 60_000);

it('uploads and decodes real private evidence, atomically attaches it and rejects foreign/retired access', async () => {
  const config = loadConfig();
  const jpeg = await sharp({
    create: { width: 160, height: 120, channels: 3, background: '#ee5f00' },
  })
    .jpeg()
    .toBuffer();
  const video = await syntheticVideo();
  expect(jpeg.length + video.length).toBeLessThan(16 * 1024);
  const vehicle = await api()
    .post('/vehicles', {
      licensePlate:
        'E' + randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
      make: 'Synthetic',
      model: 'Evidence fixture',
      branchId: owned.branchA,
    })
    .expect(201);
  const customer = await api()
    .post('/customers', {
      name: 'Synthetic evidence customer',
      phone: '0900000015',
    })
    .expect(201);
  const rental = await api()
    .post('/rentals', {
      vehicleId: vehicle.body.id as string,
      customerId: customer.body.id as string,
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
    .expect(201);
  const rentalId = rental.body.id as string;
  const base = `/rentals/${rentalId}/evidence`;
  await api().post(`/rentals/${rentalId}/reserve`, {}).expect(201);
  const declaration = {
    idempotencyKey: randomUUID(),
    type: 'HANDOVER',
    kind: 'IMAGE',
    category: 'FRONT',
    mimeType: 'image/jpeg',
    bytes: jpeg.length,
  };
  const image = (
    await api()
      .post(base + '/uploads', declaration)
      .expect(201)
  ).body as Upload;
  const repeated = (
    await api()
      .post(base + '/uploads', declaration)
      .expect(201)
  ).body as Upload;
  // Inspect only IDs; signed capabilities must never appear in assertion output.
  expect(repeated.id).toBe(image.id);
  const notReady = await api()
    .post(`${base}/uploads/${image.id}/verify`, {})
    .expect(409);
  expect(notReady.body.code).toBe('EVIDENCE_NOT_READY');
  const clip = (
    await api()
      .post(base + '/uploads', {
        idempotencyKey: randomUUID(),
        type: 'HANDOVER',
        kind: 'VIDEO',
        category: 'OTHER',
        mimeType: 'video/mp4',
        bytes: video.length,
      })
      .expect(201)
  ).body as Upload;
  const abandoned = (
    await api()
      .post(base + '/uploads', {
        ...declaration,
        idempotencyKey: randomUUID(),
        category: 'REAR',
      })
      .expect(201)
  ).body as Upload;
  for (let i = 0; i < 2; i++) {
    const cancelled = await api()
      .post(`${base}/uploads/${abandoned.id}/cancel`, {})
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');
  }
  await api().post(`${base}/uploads/${abandoned.id}/verify`, {}).expect(409);

  // Match the browser's XHR transport: multipart PUT with an empty field name,
  // public apikey and no Auth/session/server key in the Storage request.
  const form = new FormData();
  form.append('cacheControl', '60');
  form.append('', new Blob([Uint8Array.from(jpeg)], { type: 'image/jpeg' }));
  const uploadedImage = await privateFetch(image.signedUrl, {
    method: 'PUT',
    headers: { apikey: config.publishableKey, 'x-upsert': 'false' },
    body: form,
  });
  if (!uploadedImage.ok)
    throw new Error(
      'Signed multipart image upload failed (HTTP ' +
        uploadedImage.status +
        ')',
    );
  await uploadedImage.body?.cancel();
  const storage = createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const uploadedVideo = await storage.storage
    .from(clip.bucket)
    .uploadToSignedUrl(clip.objectKey, clip.token, video, {
      contentType: 'video/mp4',
      upsert: false,
    });
  if (uploadedVideo.error) throw new Error('Signed video upload failed');
  for (const upload of [image, clip]) {
    const verified = await api()
      .post(`${base}/uploads/${upload.id}/verify`, {})
      .expect(201);
    expect(verified.body.status).toBe('VERIFIED');
    const retried = await api()
      .post(`${base}/uploads/${upload.id}/verify`, {})
      .expect(201);
    expect(retried.body.status).toBe('VERIFIED');
  }
  expect((await api().get(base).expect(200)).body.data).toEqual([]);
  await api()
    .post(`/rentals/${rentalId}/handover`, {
      odometerStart: 100,
      inspection,
      evidenceUploadIds: [image.id, abandoned.id],
    })
    .expect(400);
  expect(
    (await api().get(`/rentals/${rentalId}`).expect(200)).body.status,
  ).toBe('RESERVED');
  expect(
    (await api().get(`/rentals/${rentalId}/inspections`).expect(200)).body.data,
  ).toHaveLength(0);
  await api()
    .post(`/rentals/${rentalId}/handover`, {
      odometerStart: 100,
      inspection,
      evidenceUploadIds: [image.id, clip.id],
    })
    .expect(201);
  attached = true;
  const gallery = (await api().get(base).expect(200)).body.data as Array<
    Record<string, unknown>
  >;
  expect(gallery).toHaveLength(2);
  expect(
    gallery.map((row) => String(row.kind)).sort((a, b) => a.localeCompare(b)),
  ).toEqual(['IMAGE', 'VIDEO']);
  expect(
    gallery.every(
      (row) =>
        row.type === 'HANDOVER' &&
        row.inspectionId &&
        row.uploadedBy === owned.accounts.ownerA.id,
    ),
  ).toBe(true);
  expect(JSON.stringify(gallery)).not.toContain('objectKey');
  expect(JSON.stringify(gallery)).not.toContain('token');

  const inspector = new MediaInspector();
  for (const [upload, original, kind] of [
    [image, jpeg, 'IMAGE'],
    [clip, video, 'VIDEO'],
  ] as const) {
    const authorized = await api().get(`${base}/${upload.id}/url`).expect(200);
    const signed = authorized.body as { url: string; expiresAt: string };
    expect(Date.parse(signed.expiresAt) - Date.now()).toBeLessThanOrEqual(
      60_000,
    );
    const response = await privateFetch(signed.url);
    expect(response.ok).toBe(true);
    const actual = Buffer.from(await response.arrayBuffer());
    expect(createHash('sha256').update(actual).digest('hex')).toBe(
      createHash('sha256').update(original).digest('hex'),
    );
    expect((await inspector.inspect(actual, kind)).bytes).toBe(original.length);
    const keys = await database!.pool.query<{
      bucket: string;
      object_key: string;
    }>(
      'select bucket,object_key from public.inspection_evidence where business_id=$1 and id=$2',
      [owned.businessA, upload.id],
    );
    const path = keys.rows[0];
    const unsigned = await privateFetch(
      `${config.supabaseUrl}/storage/v1/object/public/${path.bucket}/${path.object_key}`,
    );
    expect(unsigned.ok).toBe(false);
    await unsigned.body?.cancel();
    const direct = await privateFetch(
      `${config.supabaseUrl}/storage/v1/object/authenticated/${path.bucket}/${path.object_key}`,
      {
        headers: {
          apikey: config.publishableKey,
          Authorization: 'Bearer ' + fixture.tokens.ownerA,
        },
      },
    );
    expect(direct.ok).toBe(false);
    await direct.body?.cancel();
    await api('ownerB', owned.businessB)
      .get(`${base}/${upload.id}/url`)
      .expect(404);
    await api().post(`${base}/uploads/${upload.id}/cancel`, {}).expect(409);
  }
  await api('ownerB', owned.businessB).get(base).expect(404);
  await api('ownerB', owned.businessB)
    .post(base + '/uploads', { ...declaration, idempotencyKey: randomUUID() })
    .expect(404);
  for (const actor of ['platformOperator', 'customer', 'disabledA']) {
    await api(actor).get(base).expect(403);
    await api(actor).get(`${base}/${image.id}/url`).expect(403);
  }
}, 180_000);
