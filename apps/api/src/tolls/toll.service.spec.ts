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
import { CommercialService } from '../commercial/commercial.service.js';
import { TollService } from './toll.service.js';
import { TollQuery } from './dto.js';
import type { TollCsvInput } from './csv.js';
let client: PGlite,
  db: ReturnType<typeof drizzle<typeof schema>>,
  service: TollService,
  commercial: CommercialService;
let owner: TenantContext,
  foreign: TenantContext,
  vehicleId: string,
  rentalId: string,
  occurredAt: string;
async function actor(name: string): Promise<TenantContext> {
  const [b] = await db.insert(schema.businesses).values({ name }).returning();
  const userId = randomUUID();
  await client.query('insert into auth.users(id) values($1)', [userId]);
  await db.insert(schema.profiles).values({ userId, displayName: name });
  const [m] = await db
    .insert(schema.memberships)
    .values({ businessId: b.id, userId, roleKey: 'OWNER' })
    .returning();
  return {
    businessId: b.id,
    businessName: name,
    userId,
    membershipId: m.id,
    email: 'synthetic@example.test',
    role: 'OWNER',
  };
}
function csv(rows: string[], extra: Partial<TollCsvInput> = {}): TollCsvInput {
  return {
    source: 'Owner statement',
    csv: 'plate,time,amount,station,reference\n' + rows.join('\n'),
    delimiter: ',',
    mapping: {
      plate: 0,
      occurredAt: 1,
      amount: 2,
      station: 3,
      externalReference: 4,
    },
    dateFormat: 'ISO_OFFSET',
    timezoneOffset: '+07:00',
    amountFormat: 'INTEGER',
    ...extra,
  };
}
const row = (
  reference = 'REF1',
  amount = '30000',
  plate = '51A12345',
  when = occurredAt,
) => `${plate},${when},${amount},Station,${reference}`;
async function imported(input = csv([row()])) {
  const preview = await service.preview(owner, input);
  await service.import(
    owner,
    {
      ...input,
      previewHash: preview.previewHash,
      idempotencyKey: randomUUID(),
      rowNumbers: preview.rows
        .filter((x) => x.status === 'VALID')
        .map((x) => x.rowNumber),
    },
    'import',
  );
  return (await service.list(owner, new TollQuery())).data;
}
async function matched(id: string) {
  const detail = await service.detail(owner, id);
  return service.review(
    owner,
    id,
    {
      version: detail.version,
      vehicleId,
      rentalId,
      ignore: false,
      reason: 'Verified statement association',
    },
    'review',
  );
}
const tolls = () =>
  db
    .select()
    .from(schema.tollTransactions)
    .where(eq(schema.tollTransactions.businessId, owner.businessId));
const movements = () =>
  db
    .select()
    .from(schema.commercialMovements)
    .where(eq(schema.commercialMovements.businessId, owner.businessId));
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
  owner = await actor('Toll owner');
  foreign = await actor('Other tenant');
  const database = { db } as unknown as Database;
  service = new TollService(database);
  commercial = new CommercialService(database);
  const [v] = await db
    .insert(schema.vehicles)
    .values({
      businessId: owner.businessId,
      licensePlate: '51A12345',
      make: 'Synthetic',
      model: 'Fixture',
    })
    .returning();
  vehicleId = v.id;
  const [c] = await db
    .insert(schema.customers)
    .values({ businessId: owner.businessId, name: 'Synthetic', phone: '12345' })
    .returning();
  const now = Date.now();
  occurredAt = new Date(now - 60000).toISOString();
  const [r] = await db
    .insert(schema.rentals)
    .values({
      businessId: owner.businessId,
      vehicleId,
      customerId: c.id,
      startAt: new Date(now - 3600000),
      endAt: new Date(now + 3600000),
      status: 'ACTIVE',
      reservedAt: new Date(now - 3600000),
      handedOverAt: new Date(now - 1800000),
      odometerStart: 100,
    })
    .returning();
  rentalId = r.id;
});
afterAll(async () => client?.close());
it('previews without writes, scopes matches to actual rental intervals and marks future/invalid rows', async () => {
  const input = csv([
    row(),
    row(
      'FUTURE',
      '30000',
      '51A12345',
      new Date(Date.now() + 3600000).toISOString(),
    ),
    row('INVALID', '-1'),
    row('UNKNOWN', '20000', '99Z99999'),
  ]);
  const result = await service.preview(owner, input);
  expect(result.summary).toMatchObject({ total: 4, valid: 2, invalid: 2 });
  expect(result.rows[0].suggestion).toMatchObject({
    vehicleId,
    rentalId,
    ambiguous: false,
  });
  expect(result.rows[3].suggestion.vehicleId).toBeNull();
  expect(await tolls()).toEqual([]);
  expect(await movements()).toEqual([]);
});
it('imports normalized data idempotently, deduplicates safely and rejects changed reference payloads', async () => {
  const input = csv([row(), row(), row('REF2', '40000')]);
  const preview = await service.preview(owner, input);
  expect(preview.summary).toMatchObject({ valid: 2, duplicate: 1 });
  const body = {
    ...input,
    previewHash: preview.previewHash,
    idempotencyKey: randomUUID(),
    rowNumbers: [2, 3, 4],
  };
  const first = await service.import(owner, body, 'import');
  expect(first).toMatchObject({
    importedCount: 2,
    duplicateCount: 1,
    idempotent: false,
  });
  expect(await service.import(owner, body, 'retry')).toEqual({
    ...first,
    idempotent: true,
  });
  expect((await tolls()).every((x) => x.status === 'NEEDS_REVIEW')).toBe(true);
  await expect(
    service.import(owner, { ...body, rowNumbers: [2] }, 'conflict'),
  ).rejects.toMatchObject({ response: { code: 'TOLL_IDEMPOTENCY_CONFLICT' } });
  const changed = await service.preview(owner, csv([row('REF1', '999')]));
  expect(changed.rows[0].status).toBe('CONFLICT');
  await expect(
    service.import(
      owner,
      {
        ...csv([row('REF1', '999')]),
        previewHash: changed.previewHash,
        idempotencyKey: randomUUID(),
        rowNumbers: [2],
      },
      'changed',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_IMPORT_ROWS_INVALID' } });
  expect(await tolls()).toHaveLength(2);
});
it('rolls back batches, normalized rows and history when import audit fails', async () => {
  const input = csv([row()]);
  const preview = await service.preview(owner, input);
  await client.exec(
    "alter table audit_logs add constraint toll_import_test_failure check(action <> 'toll.import') not valid",
  );
  try {
    await expect(
      service.import(
        owner,
        {
          ...input,
          previewHash: preview.previewHash,
          idempotencyKey: randomUUID(),
          rowNumbers: [2],
        },
        'failed',
      ),
    ).rejects.toBeDefined();
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint toll_import_test_failure',
    );
  }
  expect(await tolls()).toHaveLength(0);
  expect(
    await db
      .select()
      .from(schema.tollImportBatches)
      .where(eq(schema.tollImportBatches.businessId, owner.businessId)),
  ).toHaveLength(0);
});
it('requires explicit reason and current version for review, supports ignore and manual attribution without inferred liability', async () => {
  const [toll] = await imported();
  await expect(
    service.record(
      owner,
      toll.id,
      {
        version: toll.version,
        reason: 'Approve',
        acknowledgePossibleDuplicate: false,
      },
      'record',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_NOT_MATCHED' } });
  await expect(
    service.review(
      owner,
      toll.id,
      {
        version: toll.version,
        reason: ' ',
        ignore: false,
        vehicleId,
        rentalId,
      },
      'review',
    ),
  ).rejects.toBeDefined();
  const ignored = await service.review(
    owner,
    toll.id,
    {
      version: toll.version,
      reason: 'Invalid row',
      ignore: true,
      vehicleId: null,
      rentalId: null,
    },
    'ignore',
  );
  expect(ignored.status).toBe('IGNORED');
  await expect(
    service.review(
      owner,
      toll.id,
      {
        version: toll.version,
        reason: 'Stale',
        ignore: false,
        vehicleId,
        rentalId,
      },
      'review',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_VERSION_CONFLICT' } });
  const confirmed = await matched(toll.id);
  expect(confirmed).toMatchObject({ status: 'MATCHED', vehicleId, rentalId });
  expect(
    (await service.detail(owner, toll.id)).history.map((x) => x.action),
  ).toEqual(['MATCH_CONFIRMED', 'IGNORED', 'IMPORTED']);
});
it('records exactly one existing Commercial TOLL expense, returns retries and preserves reversal corrections', async () => {
  const [toll] = await imported(csv([row('LARGE', '999999999999999')]));
  const confirmed = await matched(toll.id);
  const body = {
    version: confirmed.version,
    reason: 'Owner-approved expense',
    acknowledgePossibleDuplicate: false,
  };
  const recorded = await service.record(owner, toll.id, body, 'record');
  expect(recorded.status).toBe('RECORDED');
  const [movement] = await movements();
  expect(movement).toMatchObject({
    id: recorded.movementId,
    kind: 'EXPENSE',
    category: 'TOLL',
    amount: '999999999999999',
    vehicleId,
    rentalId,
  });
  expect((await service.record(owner, toll.id, body, 'retry')).movementId).toBe(
    movement.id,
  );
  await commercial.reverse(
    owner,
    movement.id,
    { reason: 'Correct via existing reversal' },
    'reverse',
  );
  expect(await service.detail(owner, toll.id)).toMatchObject({
    status: 'RECORDED',
    movementStatus: 'REVERSED',
  });
  expect((await service.record(owner, toll.id, body, 'again')).movementId).toBe(
    movement.id,
  );
  expect(await movements()).toHaveLength(2);
});
it('surfaces manual expenses without merging, requires duplicate acknowledgement and forbids ambiguous bulk', async () => {
  await commercial.create(
    owner,
    {
      kind: 'EXPENSE',
      category: 'TOLL',
      amount: '30000',
      occurredAt,
      vehicleId,
      rentalId,
      notes: 'Prior manual expense',
    },
    'manual',
  );
  const [toll] = await imported();
  expect(toll.possibleDuplicateMovementIds).toHaveLength(1);
  const confirmed = await matched(toll.id);
  await expect(
    service.record(
      owner,
      toll.id,
      {
        version: confirmed.version,
        reason: 'Review duplicate',
        acknowledgePossibleDuplicate: false,
      },
      'record',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_POSSIBLE_DUPLICATE' } });
  await expect(
    service.bulkRecord(
      owner,
      { items: [{ id: toll.id, version: confirmed.version }], reason: 'Bulk' },
      'bulk',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_BULK_REVIEW_REQUIRED' } });
  expect(
    (
      await service.record(
        owner,
        toll.id,
        {
          version: confirmed.version,
          reason: 'Distinct pass confirmed by owner',
          acknowledgePossibleDuplicate: true,
        },
        'record',
      )
    ).status,
  ).toBe('RECORDED');
  expect(await movements()).toHaveLength(2);
});
it('preserves distinct reference collisions for review and never bulk books ambiguous toll fingerprints', async () => {
  const items = await imported(csv([row('REF_A'), row('REF_B')]));
  expect(items).toHaveLength(2);
  for (const item of items) {
    expect(item.suggestion.ambiguous).toBe(true);
    await matched(item.id);
  }
  const fresh = (await service.list(owner, new TollQuery())).data;
  await expect(
    service.bulkRecord(
      owner,
      {
        items: fresh.map((x) => ({ id: x.id, version: x.version })),
        reason: 'Bulk',
      },
      'bulk',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_BULK_REVIEW_REQUIRED' } });
  expect(await movements()).toHaveLength(0);
});
it('makes selected bulk recording atomic, rejects stale entries and supports idempotent retries', async () => {
  const items = await imported(csv([row('REF_A'), row('REF_B', '40000')]));
  const confirmed = [];
  for (const item of items) confirmed.push(await matched(item.id));
  const stale = {
    items: confirmed.map((x, i) => ({
      id: x.id,
      version: x.version + (i ? 1 : 0),
    })),
    reason: 'Bulk',
  };
  await expect(service.bulkRecord(owner, stale, 'stale')).rejects.toMatchObject(
    { response: { code: 'TOLL_VERSION_CONFLICT' } },
  );
  expect(await movements()).toHaveLength(0);
  const body = {
    items: confirmed.map((x) => ({ id: x.id, version: x.version })),
    reason: 'Approved selected tolls',
  };
  expect((await service.bulkRecord(owner, body, 'bulk')).data).toHaveLength(2);
  expect((await service.bulkRecord(owner, body, 'retry')).data).toHaveLength(2);
  expect(await movements()).toHaveLength(2);
});
it('rolls back Commercial movement and source link if recording audit fails', async () => {
  const [toll] = await imported();
  const confirmed = await matched(toll.id);
  await client.exec(
    "alter table audit_logs add constraint toll_record_test_failure check(action <> 'toll.record') not valid",
  );
  try {
    await expect(
      service.record(
        owner,
        toll.id,
        {
          version: confirmed.version,
          reason: 'Approve',
          acknowledgePossibleDuplicate: false,
        },
        'failed',
      ),
    ).rejects.toBeDefined();
  } finally {
    await client.exec(
      'alter table audit_logs drop constraint toll_record_test_failure',
    );
  }
  expect(await movements()).toHaveLength(0);
  expect((await tolls())[0]).toMatchObject({
    status: 'MATCHED',
    movementId: null,
  });
});
it('fails closed for foreign tenants, revoked Owner and ungranted principals on reads and writes', async () => {
  const [toll] = await imported();
  await expect(service.detail(foreign, toll.id)).rejects.toMatchObject({
    response: { code: 'TOLL_NOT_FOUND' },
  });
  await expect(
    service.review(
      foreign,
      toll.id,
      {
        version: toll.version,
        reason: 'Foreign',
        ignore: true,
        vehicleId: null,
        rentalId: null,
      },
      'foreign',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_NOT_FOUND' } });
  await expect(
    service.list(foreign, Object.assign(new TollQuery(), { vehicleId })),
  ).rejects.toMatchObject({ response: { code: 'TOLL_NOT_FOUND' } });
  await db
    .update(schema.memberships)
    .set({ status: 'DISABLED' })
    .where(eq(schema.memberships.id, owner.membershipId));
  for (const op of [
    () => service.preview(owner, csv([row()])),
    () => service.list(owner, new TollQuery()),
    () => service.detail(owner, toll.id),
    () =>
      service.record(
        owner,
        toll.id,
        {
          version: toll.version,
          reason: 'Denied',
          acknowledgePossibleDuplicate: false,
        },
        'denied',
      ),
  ])
    await expect(op()).rejects.toMatchObject({
      response: { code: 'TENANT_ACCESS_DENIED' },
    });
  await expect(
    service.list(
      { ...foreign, membershipId: randomUUID(), role: 'CUSTOMER' },
      new TollQuery(),
    ),
  ).rejects.toMatchObject({ response: { code: 'TENANT_ACCESS_DENIED' } });
});
it('uses half-open actual handover/return intervals and preserves overlapping completed-rental ambiguity', async () => {
  const [original] = await db
    .select()
    .from(schema.rentals)
    .where(eq(schema.rentals.id, rentalId));
  const handover = original.handedOverAt!;
  const returned = new Date(Date.now() - 10_000);
  await db
    .update(schema.rentals)
    .set({ status: 'COMPLETED', returnedAt: returned, odometerEnd: 120 })
    .where(eq(schema.rentals.id, rentalId));
  const boundary = await service.preview(
    owner,
    csv([
      row('START', '1', '51A12345', handover.toISOString()),
      row('END', '2', '51A12345', returned.toISOString()),
    ]),
  );
  expect(boundary.rows[0].suggestion.rentalId).toBe(rentalId);
  expect(boundary.rows[1].suggestion.rentalId).toBeNull();
  await db.insert(schema.rentals).values({
    businessId: owner.businessId,
    vehicleId,
    customerId: original.customerId,
    startAt: original.startAt,
    endAt: original.endAt,
    status: 'COMPLETED',
    reservedAt: original.reservedAt,
    handedOverAt: handover,
    returnedAt: returned,
    odometerStart: 100,
    odometerEnd: 120,
  });
  const preview = await service.preview(owner, csv([row()]));
  expect(preview.rows[0].suggestion).toMatchObject({
    vehicleId,
    rentalId: null,
    ambiguous: true,
  });
  expect(preview.rows[0].suggestion.rentalCandidates).toHaveLength(2);
  const [toll] = await imported();
  expect(toll).toMatchObject({ status: 'NEEDS_REVIEW', rentalId: null });
  const reviewed = await matched(toll.id);
  await expect(
    service.record(
      owner,
      toll.id,
      {
        version: reviewed.version,
        reason: 'Manual attribution reviewed',
        acknowledgePossibleDuplicate: false,
      },
      'record',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_POSSIBLE_DUPLICATE' } });
  expect(
    (
      await service.record(
        owner,
        toll.id,
        {
          version: reviewed.version,
          reason: 'Owner verified despite overlapping history',
          acknowledgePossibleDuplicate: true,
        },
        'record',
      )
    ).status,
  ).toBe('RECORDED');
});
it('rejects duplicate-only CSV aliases when the canonical valid row is not selected', async () => {
  const input = csv([row(), row()]);
  const preview = await service.preview(owner, input);
  await expect(
    service.import(
      owner,
      {
        ...input,
        previewHash: preview.previewHash,
        idempotencyKey: randomUUID(),
        rowNumbers: [3],
      },
      'alias',
    ),
  ).rejects.toMatchObject({ response: { code: 'TOLL_IMPORT_ROWS_INVALID' } });
  expect(await tolls()).toHaveLength(0);
});
it('serializes duplicate record requests into a single linked expense and recording history event', async () => {
  const [toll] = await imported();
  const confirmed = await matched(toll.id);
  const body = {
    version: confirmed.version,
    reason: 'Approve once',
    acknowledgePossibleDuplicate: false,
  };
  const results = await Promise.all([
    service.record(owner, toll.id, body, 'parallel-one'),
    service.record(owner, toll.id, body, 'parallel-two'),
  ]);
  expect(results[0].movementId).toBe(results[1].movementId);
  expect(await movements()).toHaveLength(1);
  const history = (await service.detail(owner, toll.id)).history;
  expect(history.filter((x) => x.action === 'RECORDED')).toHaveLength(1);
  expect(history[0]).toMatchObject({
    status: 'RECORDED',
    vehicleId,
    rentalId,
    version: confirmed.version + 1,
  });
});
