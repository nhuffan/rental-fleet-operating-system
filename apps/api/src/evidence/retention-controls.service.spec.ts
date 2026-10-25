import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Database } from '../database/database.js';
import * as schema from '../database/schema.js';
import type { TenantContext } from '../auth/guards.js';
import { FleetService } from '../fleet/vehicles/fleet.service.js';
import { RentalService } from '../rentals/rental.service.js';
import { EvidenceRetentionControls } from './retention-controls.service.js';
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let service: EvidenceRetentionControls;
let rentalService: RentalService;
let owner: TenantContext, foreign: TenantContext;
let rentalId: string, evidenceId: string;
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
async function actor(name: string): Promise<TenantContext> {
  const [business] = await db
    .insert(schema.businesses)
    .values({ name })
    .returning();
  const userId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db.insert(schema.profiles).values({ userId, displayName: name });
  const [membership] = await db
    .insert(schema.memberships)
    .values({ businessId: business.id, userId, roleKey: 'OWNER' })
    .returning();
  return {
    userId,
    email: 'synthetic@example.test',
    businessId: business.id,
    businessName: name,
    membershipId: membership.id,
    role: 'OWNER',
  };
}
async function lifecycle() {
  return (
    await db
      .select()
      .from(schema.evidenceLifecycles)
      .where(eq(schema.evidenceLifecycles.evidenceId, evidenceId))
  )[0];
}
async function events() {
  return db
    .select()
    .from(schema.evidenceRetentionEvents)
    .where(eq(schema.evidenceRetentionEvents.businessId, owner.businessId));
}
beforeAll(async () => {
  client = new PGlite({ extensions: { btree_gist } });
  await client.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  for (const file of readdirSync('../../supabase/migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort())
    await client.exec(
      readFileSync('../../supabase/migrations/' + file, 'utf8'),
    );
  db = drizzle(client, { schema });
}, 30000);
beforeEach(async () => {
  owner = await actor('Retention Owner');
  foreign = await actor('Foreign Owner');
  const database = { db } as unknown as Database;
  service = new EvidenceRetentionControls(database);
  rentalService = new RentalService(database);
  const fleet = new FleetService(database);
  const vehicle = await fleet.createVehicle(
    owner,
    {
      licensePlate:
        'R' + randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
      make: 'Synthetic',
      model: 'Retention',
    },
    'vehicle',
  );
  const customer = await rentalService.createCustomer(
    owner,
    { name: 'Synthetic', phone: '12345' },
    'customer',
  );
  const rental = await rentalService.createRental(
    owner,
    {
      vehicleId: vehicle.id,
      customerId: customer.id,
      startAt: new Date(Date.now() - 60000).toISOString(),
      endAt: new Date(Date.now() + 3600000).toISOString(),
    },
    'rental',
  );
  rentalId = rental.id;
  evidenceId = randomUUID();
  await rentalService.reserve(owner, rentalId, 'reserve');
  const now = new Date();
  const prefix = `b/${owner.businessId}/rentals/${rentalId}/HANDOVER`;
  await db.insert(schema.evidenceUploads).values({
    id: evidenceId,
    businessId: owner.businessId,
    rentalId,
    vehicleId: vehicle.id,
    type: 'HANDOVER',
    kind: 'IMAGE',
    category: 'FRONT',
    uploadedBy: owner.userId,
    idempotencyKey: randomUUID(),
    status: 'VERIFIED',
    bucket: 'inspection-images',
    pendingKey: `${prefix}/pending/${evidenceId}.jpg`,
    objectKey: `${prefix}/evidence/${evidenceId}.jpg`,
    declaredMime: 'image/jpeg',
    declaredBytes: 100,
    mimeType: 'image/jpeg',
    bytes: 100,
    width: 640,
    height: 480,
    expiresAt: new Date(now.getTime() + 15 * 60000),
    holdUntil: new Date(now.getTime() + 125 * 60000),
    verifiedAt: now,
    reservedBytes: 2 * 1024 * 1024,
    createdAt: now,
  });
  await rentalService.handover(
    owner,
    rentalId,
    { odometerStart: 100, inspection, evidenceUploadIds: [evidenceId] },
    'handover',
  );
});
afterAll(async () => {
  await client?.close();
});
it('defaults safely to 30 days and records policy and audit atomically without enabling deletion', async () => {
  const settings = await service.settings(owner);
  expect(settings.retentionDays).toBe(30);
  const before = await events();
  expect(
    (await service.updateSettings(owner, { retentionDays: 90 }, 'policy'))
      .retentionDays,
  ).toBe(90);
  expect((await events()).length).toBe(before.length + 1);
  expect((await service.settings(foreign)).retentionDays).toBe(30);
  await client.exec(
    "alter table audit_logs add constraint retention_test_audit_failure check(action <> 'evidence.retention.policy_updated') not valid",
  );
  try {
    await expect(
      service.updateSettings(owner, { retentionDays: 30 }, 'failed'),
    ).rejects.toBeDefined();
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint retention_test_audit_failure',
    );
  }
  expect((await service.settings(owner)).retentionDays).toBe(90);
  expect((await events()).length).toBe(before.length + 1);
});
it('preserves important and legal hold reasons in immutable history while keeping audit metadata redacted', async () => {
  const note = 'Synthetic sensitive dispute reason';
  await service.updateImportant(
    owner,
    rentalId,
    evidenceId,
    { important: true, reason: `  ${note}  ` },
    'important',
  );
  expect(await lifecycle()).toMatchObject({
    important: true,
    importantReason: note,
    importantBy: owner.userId,
  });
  await service.updateHold(
    owner,
    rentalId,
    { active: true, unresolvedDispute: true, reason: note },
    'hold',
  );
  expect(await service.hold(owner, rentalId)).toMatchObject({
    active: true,
    unresolvedDispute: true,
    reason: note,
    actorId: owner.userId,
  });
  const history = await events();
  expect(history.map((row) => row.action).sort()).toEqual([
    'IMPORTANT_SET',
    'LEGAL_HOLD_SET',
  ]);
  expect(
    history.every((row) => row.reason === note && row.actorId === owner.userId),
  ).toBe(true);
  const audit = await db
    .select()
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.businessId, owner.businessId),
        eq(schema.auditLogs.entityType, 'inspection_evidence_retention'),
      ),
    );
  expect(JSON.stringify(audit.map((row) => row.metadata))).not.toContain(note);
  await expect(
    client.query('update evidence_retention_events set reason=$1 where id=$2', [
      'forbidden',
      history[0].id,
    ]),
  ).rejects.toMatchObject({ code: '23001' });
});
it('requires explicit dispute resolution and release reason, never derives a release from completion', async () => {
  await service.updateHold(
    owner,
    rentalId,
    { active: true, unresolvedDispute: true, reason: 'Open case' },
    'hold',
  );
  await rentalService.returnRental(
    owner,
    rentalId,
    { odometerEnd: 101, inspection },
    'return',
  );
  expect((await service.hold(owner, rentalId)).active).toBe(true);
  for (const body of [
    { active: false, unresolvedDispute: true, reason: 'still open' },
    { active: false, unresolvedDispute: false, reason: ' ' },
  ])
    await expect(
      service.updateHold(owner, rentalId, body, 'invalid'),
    ).rejects.toMatchObject({
      response: { code: 'EVIDENCE_RETENTION_VALIDATION' },
    });
  await service.updateHold(
    owner,
    rentalId,
    {
      active: false,
      unresolvedDispute: false,
      reason: 'Dispute resolved explicitly',
    },
    'release',
  );
  expect((await service.hold(owner, rentalId)).active).toBe(false);
  expect((await events()).map((row) => row.action)).toContain(
    'LEGAL_HOLD_RELEASED',
  );
});
it('blocks settings and protection mutations during claimed or uncertain deletion and never restores tombstones', async () => {
  for (const status of ['PURGING', 'RETRY_REQUIRED'] as const) {
    await db
      .update(schema.evidenceLifecycles)
      .set({
        status,
        leaseId: status === 'PURGING' ? randomUUID() : null,
        leaseUntil: status === 'PURGING' ? new Date(Date.now() + 60000) : null,
        nextRetryAt:
          status === 'RETRY_REQUIRED' ? new Date(Date.now() + 60000) : null,
        lastErrorCode:
          status === 'RETRY_REQUIRED' ? 'STORAGE_DELETE_FAILED' : null,
        retryCount: status === 'RETRY_REQUIRED' ? 1 : 0,
      })
      .where(eq(schema.evidenceLifecycles.evidenceId, evidenceId));
    for (const operation of [
      () => service.updateSettings(owner, { retentionDays: 90 }, 'busy'),
      () =>
        service.updateHold(
          owner,
          rentalId,
          { active: true, unresolvedDispute: false, reason: 'hold' },
          'busy',
        ),
      () =>
        service.updateImportant(
          owner,
          rentalId,
          evidenceId,
          { important: true, reason: 'hold' },
          'busy',
        ),
    ])
      await expect(operation()).rejects.toMatchObject({
        response: { code: 'EVIDENCE_RETENTION_LOCKED' },
      });
  }
  await db
    .update(schema.evidenceLifecycles)
    .set({
      status: 'PURGED',
      purgedAt: new Date(),
      leaseId: null,
      leaseUntil: null,
      nextRetryAt: null,
      lastErrorCode: null,
    })
    .where(eq(schema.evidenceLifecycles.evidenceId, evidenceId));
  await expect(
    service.updateImportant(
      owner,
      rentalId,
      evidenceId,
      { important: true, reason: 'too late' },
      'purged',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_RETENTION_LOCKED' } });
  await service.updateHold(
    owner,
    rentalId,
    {
      active: true,
      unresolvedDispute: false,
      reason: 'Protect remaining/future evidence only',
    },
    'hold',
  );
  expect((await lifecycle()).status).toBe('PURGED');
});
it('fails closed for foreign tenants and revoked or ungranted principals', async () => {
  await expect(service.hold(foreign, rentalId)).rejects.toMatchObject({
    response: { code: 'EVIDENCE_NOT_FOUND' },
  });
  await expect(
    service.updateHold(
      foreign,
      rentalId,
      { active: true, unresolvedDispute: false, reason: 'forged' },
      'foreign',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_NOT_FOUND' } });
  await expect(
    service.updateImportant(
      foreign,
      rentalId,
      evidenceId,
      { important: true, reason: 'forged' },
      'foreign',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_NOT_FOUND' } });
  await db
    .update(schema.memberships)
    .set({ status: 'DISABLED' })
    .where(eq(schema.memberships.id, owner.membershipId));
  for (const operation of [
    () => service.settings(owner),
    () => service.usage(owner),
    () => service.hold(owner, rentalId),
    () =>
      service.updateImportant(
        owner,
        rentalId,
        evidenceId,
        { important: true, reason: 'denied' },
        'revoked',
      ),
  ])
    await expect(operation()).rejects.toMatchObject({
      response: { code: 'TENANT_ACCESS_DENIED' },
    });
  const ungranted = {
    ...foreign,
    membershipId: randomUUID(),
    role: 'PLATFORM_OPERATOR',
  };
  await expect(service.settings(ungranted)).rejects.toMatchObject({
    response: { code: 'TENANT_ACCESS_DENIED' },
  });
});
it('aggregates tenant-scoped active, retained, held, purged and pending reservations without double counts', async () => {
  expect((await service.usage(owner)).active).toEqual({ count: 1, bytes: 100 });
  expect((await service.usage(foreign)).active).toEqual({ count: 0, bytes: 0 });
  const pendingId = randomUUID();
  const source = (
    await db
      .select()
      .from(schema.evidenceUploads)
      .where(eq(schema.evidenceUploads.id, evidenceId))
  )[0];
  const prefix = `b/${owner.businessId}/rentals/${rentalId}/RETURN`;
  await db.insert(schema.evidenceUploads).values({
    ...source,
    id: pendingId,
    idempotencyKey: randomUUID(),
    type: 'RETURN',
    status: 'PENDING',
    pendingKey: `${prefix}/pending/${pendingId}.jpg`,
    objectKey: `${prefix}/evidence/${pendingId}.jpg`,
    mimeType: null,
    bytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    verifiedAt: null,
  });
  expect((await service.usage(owner)).pending).toEqual({
    count: 1,
    bytes: 2 * 1024 * 1024,
  });

  await rentalService.returnRental(
    owner,
    rentalId,
    { odometerEnd: 101, inspection },
    'return',
  );
  expect((await service.usage(owner)).retained).toEqual({
    count: 1,
    bytes: 100,
  });
  await service.updateImportant(
    owner,
    rentalId,
    evidenceId,
    { important: true, reason: 'held' },
    'important',
  );
  const held = await service.usage(owner);
  expect(held.held).toEqual({ count: 1, bytes: 100 });
  expect(held.retained.count).toBe(0);
  expect(held.totalReservedBytes).toBe(4 * 1024 * 1024);
  expect(held.pending.count).toBe(1);
  await service.updateImportant(
    owner,
    rentalId,
    evidenceId,
    { important: false, reason: 'released' },
    'important',
  );
  await db
    .update(schema.evidenceLifecycles)
    .set({ status: 'PURGED', purgedAt: new Date() })
    .where(eq(schema.evidenceLifecycles.evidenceId, evidenceId));
  const purged = await service.usage(owner);
  expect(purged.purged).toEqual({ count: 1, bytes: 100 });
  expect(purged.retained.count).toBe(0);
});
it('rolls back protection and private reason history when tenant audit fails', async () => {
  await client.exec(
    "alter table audit_logs add constraint retention_protection_audit_failure check(action not in ('evidence.retention.legal_hold_set','evidence.retention.important_set')) not valid",
  );
  try {
    await expect(
      service.updateHold(
        owner,
        rentalId,
        {
          active: true,
          unresolvedDispute: true,
          reason: 'Private dispute note',
        },
        'failed',
      ),
    ).rejects.toBeDefined();
    await expect(
      service.updateImportant(
        owner,
        rentalId,
        evidenceId,
        { important: true, reason: 'Private important note' },
        'failed',
      ),
    ).rejects.toBeDefined();
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint retention_protection_audit_failure',
    );
  }
  expect((await service.hold(owner, rentalId)).active).toBe(false);
  expect((await lifecycle()).important).toBe(false);
  expect(await events()).toHaveLength(0);
});
