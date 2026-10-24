import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { EvidenceUploadCreate } from './dto.js';
const options = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};
const body = {
  idempotencyKey: randomUUID(),
  type: 'HANDOVER',
  kind: 'IMAGE',
  category: 'FRONT',
  mimeType: 'image/jpeg',
  bytes: 1000,
};
it('rejects caller-supplied object paths, attachment IDs and attribution before storage authorization', async () => {
  for (const extra of [
    { objectKey: 'b/foreign/path.jpg' },
    { bucket: 'public' },
    { uploadedBy: randomUUID() },
    { inspectionId: randomUUID() },
    { businessId: randomUUID() },
    { verifiedAt: new Date().toISOString() },
  ]) {
    expect(
      (
        await validate(
          plainToInstance(EvidenceUploadCreate, { ...body, ...extra }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  }
});
it('requires concrete bounded declarations and an opaque idempotency key', async () => {
  for (const extra of [
    { idempotencyKey: '../x' },
    { type: 'OTHER' },
    { kind: 'AUDIO' },
    { category: '../../../secret' },
    { mimeType: 'image/svg+xml' },
    { bytes: 0 },
    { bytes: 12582913 },
    { bytes: '100' },
    { bytes: 1.1 },
  ]) {
    expect(
      (
        await validate(
          plainToInstance(EvidenceUploadCreate, { ...body, ...extra }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  }
  expect(
    await validate(plainToInstance(EvidenceUploadCreate, body), options),
  ).toEqual([]);
});
