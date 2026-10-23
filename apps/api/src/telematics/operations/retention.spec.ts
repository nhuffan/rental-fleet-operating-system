import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import {
  retentionBatch,
  retentionCandidatesSql,
  retentionOptions,
  runRetention,
  type MaintenanceDatabase,
} from './retention.js';
let db: PGlite;
const tenant = randomUUID(),
  other = randomUUID(),
  active = randomUUID(),
  ended = randomUUID(),
  foreign = randomUUID();
const database: MaintenanceDatabase = {
  async connect() {
    return {
      async query<R extends Record<string, unknown>>(
        sql: string,
        values?: unknown[],
      ) {
        const result = await db.query<R>(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows };
      },
      release() {},
    };
  },
};
const options = (extra = {}) => ({
  businessId: tenant,
  apply: false,
  batchLimit: 1000,
  maxBatches: 1,
  ...extra,
});
async function point(
  assignmentId = active,
  businessId = tenant,
  recordedAt = '2020-01-01T00:00:00Z',
  receivedAt = '2020-01-01T00:00:00Z',
) {
  const id = randomUUID();
  await db.query('insert into gps_positions values($1,$2,$3,$4,$5)', [
    id,
    businessId,
    assignmentId,
    recordedAt,
    receivedAt,
  ]);
  return id;
}
async function ids() {
  return (
    await db.query<{ id: string }>('select id from gps_positions order by id')
  ).rows
    .map((row) => row.id)
    .sort();
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    'create table businesses(id uuid primary key); create table device_assignments(id uuid primary key,business_id uuid not null,unassigned_at timestamptz); create table gps_positions(id uuid primary key,business_id uuid not null,assignment_id uuid not null,recorded_at timestamptz not null,received_at timestamptz not null);',
  );
});
beforeEach(async () => {
  await db.exec('truncate gps_positions,device_assignments,businesses');
  await db.query('insert into businesses values($1),($2)', [tenant, other]);
  await db.query(
    "insert into device_assignments values($1,$2,null),($3,$2,'2020-01-02'),($4,$5,null)",
    [active, tenant, ended, foreign, other],
  );
});
afterAll(async () => {
  await db.close();
});
it('defaults to one dry-run batch and requires an explicit UUID tenant', () => {
  expect(retentionOptions([`--business=${tenant}`])).toEqual(options());
});
it.each(
  [
    [],
    [`--business=${tenant}`, '--batch-limit=1001'],
    [`--business=${tenant}`, '--batch-limit=0'],
    [`--business=${tenant}`, '--max-batches=11'],
    [`--business=${tenant}`, '--max-batches=0'],
    [`--business=${tenant}`, '--apply', '--dry-run'],
    [`--business=${tenant}`, '--apply', '--apply'],
    [`--business=${tenant}`, '--all-tenants'],
    ['--business=------------------------------------'],
  ].map((args) => ({ args })),
)('rejects unsafe/ambiguous invocation %#', ({ args }) => {
  expect(() => retentionOptions(args)).toThrow();
});
it('dry-run changes no rows and never repeats the same page for max-batches', async () => {
  await point();
  await point();
  const before = await ids();
  const result = await runRetention(
    database,
    options({ maxBatches: 10, batchLimit: 1 }),
  );
  expect(result).toMatchObject({
    mode: 'dry-run',
    eligible: 1,
    deleted: 0,
    batches: 1,
    capped: true,
  });
  expect(await ids()).toEqual(before);
});
it('expires received-time history, preserves active latest first-received tie and other tenants', async () => {
  await point();
  const latest = await point(
    active,
    tenant,
    '2020-02-01T00:00:00Z',
    '2020-02-01T00:00:00Z',
  );
  await point(active, tenant, '2020-02-01T00:00:00Z', '2020-02-02T00:00:00Z');
  await point(ended);
  const recentlyReceived = await point(
    active,
    tenant,
    '2019-01-01T00:00:00Z',
    new Date().toISOString(),
  );
  const foreignId = await point(foreign, other);
  const result = await retentionBatch(database, options({ apply: true }));
  expect(result).toMatchObject({ eligible: 3, deleted: 3, capped: false });
  expect(await ids()).toEqual([latest, recentlyReceived, foreignId].sort());
});
it('never protects a point using an assignment from another tenant', async () => {
  await point(foreign, tenant);
  expect(
    (await retentionBatch(database, options({ apply: true }))).deleted,
  ).toBe(1);
});
it('repeats only capped committed batches up to the invocation budget', async () => {
  for (let i = 0; i < 5; i++) await point(ended);
  const result = await runRetention(
    database,
    options({ apply: true, batchLimit: 2, maxBatches: 2 }),
  );
  expect(result).toMatchObject({
    eligible: 4,
    deleted: 4,
    batches: 2,
    capped: true,
  });
  expect(await ids()).toHaveLength(1);
});
it('uses a strict receivedAt cutoff, independent of recorded time', async () => {
  const cutoff = new Date('2020-02-01T00:00:00Z');
  const old = await point(
    ended,
    tenant,
    '2010-01-01T00:00:00Z',
    '2020-01-31T23:59:59.999Z',
  );
  await point(ended, tenant, '2010-01-01T00:00:00Z', cutoff.toISOString());
  const result = await db.query<{ id: string }>(retentionCandidatesSql, [
    tenant,
    cutoff,
    1000,
  ]);
  expect(result.rows.map((row) => row.id)).toEqual([old]);
});
it('takes the shared business lock before protection/deletion and rolls back an unknown tenant', async () => {
  const calls: string[] = [];
  const observed: MaintenanceDatabase = {
    async connect() {
      const c = await database.connect();
      return {
        async query<R extends Record<string, unknown>>(
          sql: string,
          values?: unknown[],
        ) {
          calls.push(sql);
          return c.query<R>(sql, values);
        },
        release() {
          c.release();
        },
      };
    },
  };
  await point(ended);
  await retentionBatch(observed, options({ apply: true }));
  expect(calls.findIndex((sql) => sql.includes('for update'))).toBeLessThan(
    calls.findIndex((sql) => sql.startsWith('select p.id')),
  );
  expect(calls.at(-1)).toBe('commit');
  await expect(
    retentionBatch(
      observed,
      options({ businessId: randomUUID(), apply: true }),
    ),
  ).rejects.toThrow('does not exist');
  expect(calls.at(-1)).toBe('rollback');
});
