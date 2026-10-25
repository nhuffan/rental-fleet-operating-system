import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Database } from '../database/database.js';
import * as schema from '../database/schema.js';
import type { TenantContext } from '../auth/guards.js';
import { FleetService } from '../fleet/vehicles/fleet.service.js';
import { RentalService } from '../rentals/rental.service.js';
import { EvidenceService } from './evidence.service.js';
import { EvidenceRetentionWorker } from './retention-worker.js';
import { EvidenceRetentionControls } from './retention-controls.service.js';
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let worker: EvidenceRetentionWorker,
  controls: EvidenceRetentionControls,
  evidence: EvidenceService;
let owner: TenantContext, rentalId: string, ids: string[];
let removed: Set<string>, calls: number, failAfterRemoval: boolean;
const inspection = {
  fuelPercent: 80,
  exteriorCondition: 'GOOD' as const,
  interiorCondition: 'GOOD' as const,
  spareTire: 'PRESENT' as const,
  tools: 'PRESENT' as const,
  registrationDocument: 'PRESENT' as const,
  insuranceDocument: 'PRESENT' as const,
  keys: 'PRESENT' as const,
};
const state = (id = ids[0]) =>
  db
    .select()
    .from(schema.evidenceLifecycles)
    .where(eq(schema.evidenceLifecycles.evidenceId, id))
    .then((rows) => rows[0]);
const batch = (extra: { apply?: boolean; limit?: number } = {}) =>
  worker.runBatch({ businessId: owner.businessId, ...extra });
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
}, 30_000);
beforeEach(async () => {
  vi.stubEnv('APP_ENV', 'development');
  vi.stubEnv('SUPABASE_URL', 'https://eeryymswcufnebibigqf.supabase.co');
  vi.stubEnv('EVIDENCE_RETENTION_DELETE_ENABLED', 'true');
  const [business] = await db
    .insert(schema.businesses)
    .values({ name: 'Retention worker fixture' })
    .returning();
  const userId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db.insert(schema.profiles).values({ userId, displayName: 'Synthetic' });
  const [member] = await db
    .insert(schema.memberships)
    .values({ businessId: business.id, userId, roleKey: 'OWNER' })
    .returning();
  owner = {
    userId,
    email: 'synthetic@example.test',
    businessId: business.id,
    businessName: business.name,
    membershipId: member.id,
    role: 'OWNER',
  };
  const database = { db } as unknown as Database;
  controls = new EvidenceRetentionControls(database);
  worker = new EvidenceRetentionWorker(database);
  evidence = new EvidenceService(database);
  const rentals = new RentalService(database),
    fleet = new FleetService(database);
  const customer = await rentals.createCustomer(
    owner,
    { name: 'Synthetic', phone: '123456' },
    'customer',
  );
  const vehicle = await fleet.createVehicle(
    owner,
    {
      licensePlate:
        'R' + randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
      make: 'QA',
      model: 'Retention',
    },
    'vehicle',
  );
  const rental = await rentals.createRental(
    owner,
    {
      customerId: customer.id,
      vehicleId: vehicle.id,
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    'rental',
  );
  rentalId = rental.id;
  await rentals.reserve(owner, rentalId, 'reserve');
  ids = [randomUUID(), randomUUID()];
  for (const id of ids) {
    const prefix = `b/${owner.businessId}/rentals/${rentalId}/HANDOVER`;
    await db.insert(schema.evidenceUploads).values({
      id,
      businessId: owner.businessId,
      rentalId,
      vehicleId: vehicle.id,
      type: 'HANDOVER',
      kind: 'IMAGE',
      category: 'FRONT',
      uploadedBy: userId,
      idempotencyKey: randomUUID(),
      status: 'VERIFIED',
      bucket: 'inspection-images',
      pendingKey: `${prefix}/pending/${id}.jpg`,
      objectKey: `${prefix}/evidence/${id}.jpg`,
      declaredMime: 'image/jpeg',
      declaredBytes: 100,
      mimeType: 'image/jpeg',
      bytes: 100,
      width: 640,
      height: 480,
      expiresAt: new Date(Date.now() + 900_000),
      holdUntil: new Date(Date.now() + 125 * 60_000),
      verifiedAt: new Date(),
      reservedBytes: 2 * 1024 * 1024,
    });
  }
  await rentals.handover(
    owner,
    rentalId,
    { odometerStart: 100, inspection, evidenceUploadIds: ids },
    'handover',
  );
  await rentals.returnRental(
    owner,
    rentalId,
    { odometerEnd: 120, inspection },
    'return',
  );
  await db
    .update(schema.rentals)
    .set({
      reservedAt: new Date(Date.now() - 42 * 86_400_000),
      handedOverAt: new Date(Date.now() - 41 * 86_400_000),
      returnedAt: new Date(Date.now() - 31 * 86_400_000),
    })
    .where(eq(schema.rentals.id, rentalId));
  removed = new Set();
  calls = 0;
  failAfterRemoval = false;
  const storage = {
    remove: async (_bucket: string, keys: string[]) => {
      calls++;
      for (const key of keys) removed.add(key);
      if (failAfterRemoval) {
        failAfterRemoval = false;
        throw new Error('Synthetic lost Storage acknowledgement');
      }
    },
    signRead: vi.fn(async () => 'https://example.test/authorized'),
  };
  Object.assign(worker, { storage });
  Object.assign(evidence, { storage });
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => client?.close());
it('defaults to mutation-free dry-run, reports only this tenant and requires development enablement', async () => {
  vi.stubEnv('EVIDENCE_RETENTION_DELETE_ENABLED', 'false');
  expect(await batch()).toMatchObject({
    mode: 'DRY_RUN',
    eligible: 2,
    purged: 0,
  });
  expect(calls).toBe(0);
  expect((await state()).status).toBe('ACTIVE');
  await expect(batch({ apply: true })).rejects.toMatchObject({
    response: { code: 'EVIDENCE_RETENTION_DISABLED' },
  });
  expect((await worker.runBatch({ businessId: randomUUID() })).eligible).toBe(
    0,
  );
});
it('protects Important, unresolved Legal holds, policy extensions and disabled businesses', async () => {
  await controls.updateImportant(
    owner,
    rentalId,
    ids[0],
    { important: true, reason: 'Synthetic preserve' },
    'important',
  );
  expect((await batch({ apply: true })).purged).toBe(1);
  expect((await state()).status).toBe('ACTIVE');
  await controls.updateHold(
    owner,
    rentalId,
    { active: true, unresolvedDispute: true, reason: 'Synthetic dispute' },
    'hold',
  );
  expect((await batch({ apply: true })).eligible).toBe(0);
  expect(
    (await evidence.list(owner, rentalId)).data.find((x) => x.id === ids[0]),
  ).toMatchObject({ canRead: true, legalHold: true });
  await controls.updateHold(
    owner,
    rentalId,
    { active: false, unresolvedDispute: false, reason: 'Resolved explicitly' },
    'release',
  );
  await controls.updateImportant(
    owner,
    rentalId,
    ids[0],
    { important: false, reason: 'No longer needed' },
    'release',
  );
  await controls.updateSettings(owner, { retentionDays: 90 }, 'extend');
  expect((await batch()).eligible).toBe(0);
  await controls.updateSettings(owner, { retentionDays: 30 }, 'shorten');
  await db
    .update(schema.businesses)
    .set({ status: 'DISABLED' })
    .where(eq(schema.businesses.id, owner.businessId));
  expect((await batch({ apply: true })).eligible).toBe(0);
});
it('keeps immutable metadata, blocks expired/purged signed reads and preserves pending quota until janitor cleanup', async () => {
  await expect(
    evidence.signedRead(owner, rentalId, ids[0]),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_MEDIA_UNAVAILABLE' } });
  const before = await db
    .select()
    .from(schema.rentalInspections)
    .where(eq(schema.rentalInspections.rentalId, rentalId));
  expect(await batch({ apply: true })).toMatchObject({
    eligible: 2,
    purged: 2,
    failed: 0,
  });
  expect(await state()).toMatchObject({ status: 'PURGED', important: false });
  expect((await evidence.list(owner, rentalId)).data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: ids[0],
        retentionStatus: 'PURGED',
        bytes: 100,
        canRead: false,
      }),
    ]),
  );
  await expect(
    evidence.signedRead(owner, rentalId, ids[0], true),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_MEDIA_UNAVAILABLE' } });
  expect(
    await db
      .select()
      .from(schema.rentalInspections)
      .where(eq(schema.rentalInspections.rentalId, rentalId)),
  ).toEqual(before);
  expect(
    (
      await db
        .select()
        .from(schema.evidenceUploads)
        .where(eq(schema.evidenceUploads.id, ids[0]))
    )[0].reservedBytes,
  ).toBe(1024 * 1024);
  for (const id of ids)
    await db
      .update(schema.evidenceUploads)
      .set({ holdUntil: new Date(Date.now() - 1000) })
      .where(eq(schema.evidenceUploads.id, id));
  expect(await evidence.cleanupExpired()).toMatchObject({ pendingRemoved: 2 });
  expect(
    (
      await db
        .select()
        .from(schema.evidenceUploads)
        .where(eq(schema.evidenceUploads.id, ids[0]))
    )[0].reservedBytes,
  ).toBe(0);
  expect((await batch({ apply: true })).purged).toBe(0);
});
it('handles a lost delete acknowledgement, partial batch success, bounded retry and missing-object idempotency', async () => {
  failAfterRemoval = true;
  expect(await batch({ apply: true })).toMatchObject({
    retryRequired: 1,
    purged: 1,
    failed: 0,
  });
  const retry = (
    await db
      .select()
      .from(schema.evidenceLifecycles)
      .where(eq(schema.evidenceLifecycles.businessId, owner.businessId))
  ).find((x) => x.status === 'RETRY_REQUIRED')!;
  expect(retry.retryCount).toBe(1);
  expect(retry.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
  await expect(
    controls.updateHold(
      owner,
      rentalId,
      { active: true, unresolvedDispute: true, reason: 'Too late' },
      'hold',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_RETENTION_LOCKED' } });
  expect((await batch({ apply: true })).eligible).toBe(0);
  await db
    .update(schema.evidenceLifecycles)
    .set({ nextRetryAt: new Date(Date.now() - 1000) })
    .where(eq(schema.evidenceLifecycles.evidenceId, retry.evidenceId));
  expect((await batch({ apply: true })).purged).toBe(1);
  expect((await state(retry.evidenceId)).status).toBe('PURGED');
});
it('exclusively claims jobs, rejects racing holds, recovers leases and prevents stale claim finalization', async () => {
  const internal = worker as unknown as {
    claim(
      businessId: string,
      id: string,
    ): Promise<{ businessId: string; id: string; leaseId: string } | null>;
    purge(claim: {
      businessId: string;
      id: string;
      leaseId: string;
    }): Promise<string>;
  };
  const first = (await internal.claim(owner.businessId, ids[0]))!;
  expect(await internal.claim(owner.businessId, ids[0])).toBeNull();
  await expect(
    controls.updateImportant(
      owner,
      rentalId,
      ids[0],
      { important: true, reason: 'Race' },
      'important',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_RETENTION_LOCKED' } });
  await db
    .update(schema.evidenceLifecycles)
    .set({ leaseUntil: new Date(Date.now() - 1000) })
    .where(eq(schema.evidenceLifecycles.evidenceId, ids[0]));
  const second = (await internal.claim(owner.businessId, ids[0]))!;
  expect(second.leaseId).not.toBe(first.leaseId);
  expect(await internal.purge(first)).toBe('skipped');
  expect(calls).toBe(0);
  expect(await internal.purge(second)).toBe('purged');
  expect(calls).toBe(1);
});
it('rechecks a hold that wins before the claim and never deletes held evidence', async () => {
  await controls.updateHold(
    owner,
    rentalId,
    { active: true, unresolvedDispute: false, reason: 'Before claim' },
    'hold',
  );
  expect(await batch({ apply: true })).toMatchObject({
    eligible: 0,
    purged: 0,
  });
  expect(calls).toBe(0);
});
it('leaves an uncertain lease when tombstone audit commit fails, then reconciles idempotently', async () => {
  await client.exec(
    "alter table audit_logs add constraint retention_purge_audit_failure check(action <> 'inspection.evidence.purged') not valid",
  );
  try {
    expect((await batch({ apply: true, limit: 1 })).failed).toBe(1);
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint retention_purge_audit_failure',
    );
  }
  const uncertain = (
    await db
      .select()
      .from(schema.evidenceLifecycles)
      .where(eq(schema.evidenceLifecycles.businessId, owner.businessId))
  ).find((x) => x.status === 'PURGING')!;
  expect(uncertain).toBeDefined();
  expect(
    (await evidence.list(owner, rentalId)).data.find(
      (x) => x.id === uncertain.evidenceId,
    )?.canRead,
  ).toBe(false);
  await db
    .update(schema.evidenceLifecycles)
    .set({ leaseUntil: new Date(Date.now() - 1000) })
    .where(eq(schema.evidenceLifecycles.evidenceId, uncertain.evidenceId));
  expect((await batch({ apply: true })).purged).toBe(2);
});

it('issues an authorized download with an attachment filename and expiry bounded by the remaining retention window', async () => {
  const deadline = new Date(Date.now() + 45_000);
  await db
    .update(schema.rentals)
    .set({ returnedAt: new Date(+deadline - 30 * 86_400_000) })
    .where(eq(schema.rentals.id, rentalId));
  let ttl = 0,
    name = '';
  Object.assign(evidence, {
    storage: {
      signRead: async (
        _bucket: string,
        _key: string,
        seconds: number,
        filename: string,
      ) => {
        ttl = seconds;
        name = filename;
        return 'https://example.test/download';
      },
    },
  });
  const result = await evidence.signedRead(owner, rentalId, ids[0], true);
  expect(ttl).toBeGreaterThan(0);
  expect(ttl).toBeLessThanOrEqual(45);
  expect(result.expiresAt.getTime()).toBeLessThanOrEqual(+deadline);
  expect(name).toBe(`inspection-handover-${ids[0]}.jpg`);
});
