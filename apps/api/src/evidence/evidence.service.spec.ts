import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Database } from '../database/database.js';
import * as schema from '../database/schema.js';
import type { TenantContext } from '../auth/guards.js';
import { FleetService } from '../fleet/vehicles/fleet.service.js';
import { RentalService } from '../rentals/rental.service.js';
import { EvidenceService } from './evidence.service.js';
import type { EvidenceUploadCreate } from './dto.js';
import { mediaCap } from './config.js';
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let service: EvidenceService;
let rentals: RentalService;
let a: TenantContext, b: TenantContext;
let rentalId: string;
let objects: Map<string, Buffer>;
let failCopy: boolean;
const inspection = {
  fuelPercent: 80,
  exteriorCondition: 'GOOD' as const,
  interiorCondition: 'GOOD' as const,
  spareTire: 'PRESENT' as const,
  tools: 'NOT_APPLICABLE' as const,
  registrationDocument: 'PRESENT' as const,
  insuranceDocument: 'PRESENT' as const,
  keys: 'PRESENT' as const,
};
async function actor(
  name: string,
  businessId?: string,
): Promise<TenantContext> {
  const business = businessId
    ? { id: businessId }
    : (await db.insert(schema.businesses).values({ name }).returning())[0];
  const userId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db
    .insert(schema.profiles)
    .values({ userId, displayName: 'Evidence fixture' });
  const [member] = await db
    .insert(schema.memberships)
    .values({ businessId: business.id, userId, roleKey: 'OWNER' })
    .returning();
  return {
    userId,
    email: 'fixture@example.test',
    businessId: business.id,
    businessName: name,
    membershipId: member.id,
    role: 'OWNER',
  };
}
const payload = (
  extra: Partial<EvidenceUploadCreate> = {},
): EvidenceUploadCreate => ({
  idempotencyKey: randomUUID(),
  type: 'HANDOVER',
  kind: 'IMAGE',
  category: 'FRONT',
  mimeType: 'image/jpeg',
  bytes: 100,
  ...extra,
});
async function stage(body = payload()) {
  return service.begin(a, rentalId, body, 'stage');
}
async function verified(body = payload()) {
  const upload = await stage(body);
  objects.set(upload.bucket + ':' + upload.objectKey, Buffer.alloc(body.bytes));
  await service.verify(a, rentalId, upload.id, 'verify');
  return upload;
}
async function record(id: string) {
  return (
    await db
      .select()
      .from(schema.evidenceUploads)
      .where(eq(schema.evidenceUploads.id, id))
  )[0];
}
beforeAll(async () => {
  client = new PGlite({ extensions: { btree_gist } });
  await client.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  for (const file of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await client.exec(
      readFileSync('../../supabase/migrations/' + file, 'utf8'),
    );
  db = drizzle(client, { schema });
}, 30000);
beforeEach(async () => {
  delete process.env.EVIDENCE_MAX_TENANT_BYTES;
  objects = new Map();
  failCopy = false;
  a = await actor('Evidence A');
  b = await actor('Evidence B');
  service = new EvidenceService({ db } as unknown as Database);
  rentals = new RentalService({ db } as unknown as Database);
  const fleet = new FleetService({ db } as unknown as Database);
  const customer = await rentals.createCustomer(
    a,
    { name: 'Evidence fixture', phone: '12345' },
    'customer',
  );
  const vehicle = await fleet.createVehicle(
    a,
    {
      licensePlate:
        'EV' + randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase(),
      make: 'QA',
      model: 'Evidence',
    },
    'vehicle',
  );
  const rental = await rentals.createRental(
    a,
    {
      customerId: customer.id,
      vehicleId: vehicle.id,
      startAt: new Date(Date.now() - 60000).toISOString(),
      endAt: new Date(Date.now() + 3600000).toISOString(),
    },
    'draft',
  );
  rentalId = rental.id;
  await rentals.reserve(a, rentalId, 'reserve');
  Object.assign(service, {
    storage: {
      assertConfigured: () => undefined,
      authorize: async () => ({
        token: 'synthetic-upload-token',
        signedUrl: 'https://storage.example.test/signed',
      }),
      download: async (bucket: string, key: string) => {
        const value = objects.get(bucket + ':' + key);
        if (!value) throw new ServiceUnavailableException();
        return value;
      },
      copy: async (bucket: string, from: string, to: string) => {
        if (failCopy) {
          failCopy = false;
          throw new ServiceUnavailableException();
        }
        objects.set(bucket + ':' + to, objects.get(bucket + ':' + from)!);
      },
      signRead: async () => 'https://storage.example.test/private-read',
      remove: async (bucket: string, keys: string[]) => {
        for (const key of keys) objects.delete(bucket + ':' + key);
      },
    },
    inspector: {
      inspect: async (buffer: Buffer, kind: string) => {
        if (buffer[0] === 255)
          throw new BadRequestException({ code: 'EVIDENCE_INVALID_FILE' });
        return {
          mimeType: kind === 'IMAGE' ? 'image/jpeg' : 'video/mp4',
          bytes: buffer.length,
          width: 640,
          height: 480,
          durationSeconds: kind === 'IMAGE' ? null : 20,
        };
      },
    },
  });
});
afterAll(async () => {
  delete process.env.EVIDENCE_MAX_TENANT_BYTES;
  await client?.close();
});
it('stages exact server paths with a bounded workflow and holds quota beyond signed capability expiry', async () => {
  const upload = await stage();
  const row = await record(upload.id);
  expect(upload).toMatchObject({
    status: 'PENDING',
    bucket: 'inspection-images',
    limits: { maxImages: 8, maxVideos: 1, maxVideoSeconds: 30 },
  });
  expect(upload.objectKey).toBe(
    `b/${a.businessId}/rentals/${rentalId}/HANDOVER/pending/${row.id}.jpg`,
  );
  expect(row.objectKey).toBe(
    `b/${a.businessId}/rentals/${rentalId}/HANDOVER/evidence/${row.id}.jpg`,
  );
  expect(row.uploadedBy).toBe(a.userId);
  expect(row.reservedBytes).toBe(2 * mediaCap('IMAGE'));
  expect(row.holdUntil!.getTime() - row.createdAt.getTime()).toBe(125 * 60000);
  expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(15 * 60000);
  expect((await service.list(a, rentalId)).data).toEqual([]);
});
it('supports idempotent staging and verification retry without duplicating files or releasing quota', async () => {
  const body = payload();
  const upload = await stage(body);
  expect((await stage(body)).id).toBe(upload.id);
  await expect(
    stage(payload({ idempotencyKey: body.idempotencyKey, category: 'REAR' })),
  ).rejects.toMatchObject({
    response: { code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' },
  });
  await expect(
    service.verify(a, rentalId, upload.id, 'missing'),
  ).rejects.toBeDefined();
  expect((await record(upload.id)).status).toBe('PENDING');
  objects.set(upload.bucket + ':' + upload.objectKey, Buffer.alloc(body.bytes));
  failCopy = true;
  await expect(
    service.verify(a, rentalId, upload.id, 'retry'),
  ).rejects.toBeDefined();
  expect((await record(upload.id)).status).toBe('PENDING');
  expect(
    (await service.verify(a, rentalId, upload.id, 'verified')).status,
  ).toBe('VERIFIED');
  expect((await service.verify(a, rentalId, upload.id, 'repeat')).status).toBe(
    'VERIFIED',
  );
  expect((await record(upload.id)).reservedBytes).toBe(2 * mediaCap('IMAGE'));
});
it('allows recovery after an expired verification lease and never restarts a live verifier', async () => {
  const upload = await stage();
  objects.set(upload.bucket + ':' + upload.objectKey, Buffer.alloc(100));
  await db
    .update(schema.evidenceUploads)
    .set({ status: 'VERIFYING', leaseUntil: new Date(Date.now() + 60000) })
    .where(eq(schema.evidenceUploads.id, upload.id));
  await expect(
    service.verify(a, rentalId, upload.id, 'parallel'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_VERIFYING' } });
  await db
    .update(schema.evidenceUploads)
    .set({ leaseUntil: new Date(Date.now() - 1000) })
    .where(eq(schema.evidenceUploads.id, upload.id));
  expect(
    (await service.verify(a, rentalId, upload.id, 'recovery')).status,
  ).toBe('VERIFIED');
});
it('rejects malformed and MIME-mismatched actual objects, not merely file declarations', async () => {
  const upload = await stage();
  objects.set(upload.bucket + ':' + upload.objectKey, Buffer.alloc(100, 255));
  await expect(
    service.verify(a, rentalId, upload.id, 'malformed'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_FILE' } });
  expect((await record(upload.id)).status).toBe('REJECTED');
  const mismatch = await stage(payload({ mimeType: 'image/webp' }));
  objects.set(mismatch.bucket + ':' + mismatch.objectKey, Buffer.alloc(100));
  await expect(
    service.verify(a, rentalId, mismatch.id, 'mismatch'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_FILE' } });
  expect((await record(mismatch.id)).status).toBe('REJECTED');
});
it('enforces concurrent and worst-case physical tenant quotas even when clients claim tiny files', async () => {
  process.env.EVIDENCE_MAX_TENANT_BYTES = String(24 * 1024 * 1024);
  await stage(payload({ kind: 'VIDEO', mimeType: 'video/mp4', bytes: 1 }));
  await expect(stage()).rejects.toMatchObject({
    response: { code: 'EVIDENCE_QUOTA_EXCEEDED' },
  });
  delete process.env.EVIDENCE_MAX_TENANT_BYTES;
  // The video already occupies one of the three active verification slots.
  await stage();
  await stage();
  await expect(stage()).rejects.toMatchObject({
    response: { code: 'EVIDENCE_QUOTA_EXCEEDED' },
  });
});
it('enforces the eight-image/one-video budget and attaches only inside the milestone transaction', async () => {
  const uploads = [];
  for (let i = 0; i < 8; i++) uploads.push(await verified());
  await expect(stage()).rejects.toMatchObject({
    response: { code: 'EVIDENCE_QUOTA_EXCEEDED' },
  });
  uploads.push(
    await verified(payload({ kind: 'VIDEO', mimeType: 'video/mp4' })),
  );
  await expect(
    stage(payload({ kind: 'VIDEO', mimeType: 'video/mp4' })),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_QUOTA_EXCEEDED' } });
  const result = await rentals.handover(
    a,
    rentalId,
    {
      odometerStart: 100,
      inspection,
      evidenceUploadIds: uploads.map((x) => x.id),
    },
    'handover',
  );
  expect(result.status).toBe('ACTIVE');
  const gallery = (await service.list(a, rentalId)).data;
  expect(gallery).toHaveLength(9);
  expect(
    gallery.every((row) => row.inspectionId && row.uploadedBy === a.userId),
  ).toBe(true);
  expect(JSON.stringify(gallery)).not.toContain('objectKey');
  expect(JSON.stringify(gallery)).not.toContain('token');
  await expect(
    service.cancel(a, rentalId, uploads[0].id, 'cancel'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_UPLOAD_LOCKED' } });
});
it('rolls back inspection, attachment and lifecycle if the shared audit transaction fails', async () => {
  const upload = await verified();
  await client.exec(
    "alter table audit_logs add constraint evidence_test_audit_failure check(action <> 'rental.handover') not valid",
  );
  try {
    await expect(
      rentals.handover(
        a,
        rentalId,
        { odometerStart: 100, inspection, evidenceUploadIds: [upload.id] },
        'failed',
      ),
    ).rejects.toBeDefined();
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint evidence_test_audit_failure',
    );
  }
  expect((await rentals.rental(a, rentalId)).status).toBe('RESERVED');
  expect((await rentals.rentalInspections(a, rentalId)).data).toHaveLength(0);
  expect((await service.list(a, rentalId)).data).toHaveLength(0);
  expect((await record(upload.id)).status).toBe('VERIFIED');
});
it('rejects pending, expired, duplicate, foreign-uploader and cross-milestone attachments atomically', async () => {
  const pending = await stage();
  await expect(
    rentals.handover(
      a,
      rentalId,
      { odometerStart: 100, inspection, evidenceUploadIds: [pending.id] },
      'pending',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_UPLOAD' } });
  const upload = await verified();
  await expect(
    rentals.handover(
      a,
      rentalId,
      {
        odometerStart: 100,
        inspection,
        evidenceUploadIds: [upload.id, upload.id],
      },
      'duplicate',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_UPLOAD' } });
  const other = await actor('Other Owner', a.businessId);
  await expect(
    rentals.handover(
      other,
      rentalId,
      { odometerStart: 100, inspection, evidenceUploadIds: [upload.id] },
      'uploader',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_UPLOAD' } });
  await db
    .update(schema.evidenceUploads)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(schema.evidenceUploads.id, upload.id));
  await expect(
    rentals.handover(
      a,
      rentalId,
      { odometerStart: 100, inspection, evidenceUploadIds: [upload.id] },
      'expired',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_UPLOAD' } });
  expect((await rentals.rentalInspections(a, rentalId)).data).toHaveLength(0);
  await rentals.handover(
    a,
    rentalId,
    { odometerStart: 100, inspection },
    'handover',
  );
  const returned = await verified(payload({ type: 'RETURN' }));
  expect((await record(returned.id)).type).toBe('RETURN');
  await expect(
    rentals.returnRental(
      a,
      rentalId,
      { odometerEnd: 110, inspection, evidenceUploadIds: [upload.id] },
      'wrong-milestone',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_UPLOAD' } });
  expect((await rentals.rental(a, rentalId)).status).toBe('ACTIVE');
});
it('denies other tenants and disabled Owners for upload, verify, gallery and signed reads', async () => {
  const upload = await verified();
  await expect(
    service.begin(b, rentalId, payload(), 'foreign'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_NOT_FOUND' } });
  await expect(
    service.verify(b, rentalId, upload.id, 'foreign'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_NOT_FOUND' } });
  await expect(service.list(b, rentalId)).rejects.toMatchObject({
    response: { code: 'EVIDENCE_NOT_FOUND' },
  });
  await expect(
    service.signedRead(b, rentalId, upload.id),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_NOT_FOUND' } });
  await db
    .update(schema.memberships)
    .set({ status: 'DISABLED' })
    .where(eq(schema.memberships.id, a.membershipId));
  for (const op of [
    () => service.begin(a, rentalId, payload(), 'disabled'),
    () => service.verify(a, rentalId, upload.id, 'disabled'),
    () => service.list(a, rentalId),
    () => service.signedRead(a, rentalId, upload.id),
  ])
    await expect(op()).rejects.toMatchObject({
      response: { code: 'TENANT_ACCESS_DENIED' },
    });
});
it('cancels without freeing capability quota and cleans only abandoned pending/final objects after the hold', async () => {
  const upload = await verified();
  const row = await record(upload.id);
  await service.cancel(a, rentalId, upload.id, 'cancel');
  expect((await record(upload.id)).reservedBytes).toBe(row.reservedBytes);
  expect(await service.cleanupExpired()).toEqual({
    purged: 0,
    pendingRemoved: 0,
  });
  expect(objects.has(row.bucket + ':' + row.pendingKey)).toBe(true);
  await db
    .update(schema.evidenceUploads)
    .set({ holdUntil: new Date(Date.now() - 1000) })
    .where(eq(schema.evidenceUploads.id, row.id));
  expect(await service.cleanupExpired()).toEqual({
    purged: 1,
    pendingRemoved: 0,
  });
  expect(await record(upload.id)).toMatchObject({
    status: 'PURGED',
    reservedBytes: 0,
    holdUntil: null,
  });
  expect(objects.size).toBe(0);
});
it('retains attached immutable final objects while deleting only expired signed-upload targets', async () => {
  const upload = await verified();
  const row = await record(upload.id);
  await rentals.handover(
    a,
    rentalId,
    { odometerStart: 100, inspection, evidenceUploadIds: [upload.id] },
    'handover',
  );
  await db
    .update(schema.evidenceUploads)
    .set({ holdUntil: new Date(Date.now() - 1000) })
    .where(eq(schema.evidenceUploads.id, row.id));
  expect(await service.cleanupExpired()).toEqual({
    purged: 0,
    pendingRemoved: 1,
  });
  expect(await record(upload.id)).toMatchObject({
    status: 'ATTACHED',
    reservedBytes: 100,
    holdUntil: null,
  });
  expect(objects.has(row.bucket + ':' + row.pendingKey)).toBe(false);
  expect(objects.has(row.bucket + ':' + row.objectKey)).toBe(true);
  const authorization = await service.signedRead(a, rentalId, upload.id);
  expect(authorization.url).toBe('https://storage.example.test/private-read');
  expect(authorization.expiresAt.getTime()).toBeGreaterThan(Date.now());
  expect(
    await db
      .select()
      .from(schema.evidenceAttachments)
      .where(
        and(
          eq(schema.evidenceAttachments.businessId, a.businessId),
          eq(schema.evidenceAttachments.id, upload.id),
        ),
      ),
  ).toHaveLength(1);
});

it.each(['resolved', 'failed'] as const)(
  'does not let a stale %s verifier overwrite or clear its successor lease',
  async (outcome) => {
    const upload = await stage();
    objects.set(upload.bucket + ':' + upload.objectKey, Buffer.alloc(100));
    let successorLease: Date | undefined;
    Object.assign(service, {
      inspector: {
        inspect: async () => {
          const first = await record(upload.id);
          successorLease = new Date(first.leaseUntil!.getTime() + 60_000);
          await db
            .update(schema.evidenceUploads)
            .set({ leaseUntil: successorLease })
            .where(eq(schema.evidenceUploads.id, upload.id));
          if (outcome === 'failed') throw new ServiceUnavailableException();
          return {
            mimeType: 'image/jpeg',
            bytes: 100,
            width: 640,
            height: 480,
            durationSeconds: null,
          };
        },
      },
    });
    await expect(
      service.verify(a, rentalId, upload.id, 'stale'),
    ).rejects.toBeDefined();
    const retained = await record(upload.id);
    expect(retained.status).toBe('VERIFYING');
    expect(retained.leaseUntil).toEqual(successorLease);
    expect(retained.verifiedAt).toBeNull();
  },
);
it('does not verify or attach a file cancelled while its decoder is running', async () => {
  const upload = await stage();
  objects.set(upload.bucket + ':' + upload.objectKey, Buffer.alloc(100));
  Object.assign(service, {
    inspector: {
      inspect: async () => {
        await service.cancel(a, rentalId, upload.id, 'cancel-decoding');
        return {
          mimeType: 'image/jpeg',
          bytes: 100,
          width: 640,
          height: 480,
          durationSeconds: null,
        };
      },
    },
  });
  await expect(
    service.verify(a, rentalId, upload.id, 'cancel-race'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_UPLOAD_EXPIRED' } });
  expect((await record(upload.id)).status).toBe('CANCELLED');
  expect((await service.list(a, rentalId)).data).toHaveLength(0);
});
it('rechecks Owner authorization after decoding and fails closed on revocation', async () => {
  const upload = await stage();
  objects.set(upload.bucket + ':' + upload.objectKey, Buffer.alloc(100));
  Object.assign(service, {
    inspector: {
      inspect: async () => {
        await db
          .update(schema.memberships)
          .set({ status: 'DISABLED' })
          .where(eq(schema.memberships.id, a.membershipId));
        return {
          mimeType: 'image/jpeg',
          bytes: 100,
          width: 640,
          height: 480,
          durationSeconds: null,
        };
      },
    },
  });
  await expect(
    service.verify(a, rentalId, upload.id, 'revoked-decoding'),
  ).rejects.toMatchObject({ response: { code: 'TENANT_ACCESS_DENIED' } });
  expect((await record(upload.id)).status).toBe('VERIFYING');
  expect((await record(upload.id)).verifiedAt).toBeNull();
});
it('does not report expired verified drafts as attachable during retry', async () => {
  const upload = await verified();
  await db
    .update(schema.evidenceUploads)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(schema.evidenceUploads.id, upload.id));
  await expect(
    service.verify(a, rentalId, upload.id, 'expired-retry'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_UPLOAD_EXPIRED' } });
});
