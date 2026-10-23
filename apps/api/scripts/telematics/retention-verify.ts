import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createPool } from '../../src/database/database.js';
import {
  retentionBatch,
  runRetention,
} from '../../src/telematics/operations/retention.js';
import { assertDevelopmentMaintenance } from './maintenance.js';
// Real PostgreSQL locking verification, isolated from Auth fixtures and other users.
// Every persisted row is owned by the two randomly generated fixture businesses.
async function main() {
  assertDevelopmentMaintenance();
  if (process.argv.length > 2)
    throw new Error('This command takes no arguments');
  const pool = createPool();
  const fixtures = [0, 1].map(() => ({
    business: randomUUID(),
    vehicle: randomUUID(),
    device: randomUUID(),
    assignment: randomUUID(),
  }));
  let writer: PoolClient | undefined;
  let waiting:
    | Promise<{
        result?: Awaited<ReturnType<typeof retentionBatch>>;
        error?: unknown;
      }>
    | undefined;
  const old = new Date(Date.now() - 40 * 86400000),
    started = new Date(old.getTime() - 86400000);
  try {
    const setup = await pool.connect();
    try {
      await setup.query('begin');
      for (const f of fixtures) {
        await setup.query(
          "insert into public.businesses(id,name) values($1,'Owned retention verification')",
          [f.business],
        );
        await setup.query(
          "insert into public.vehicles(id,business_id,license_plate,make,model) values($1,$2,$3,'TEST','Retention verification')",
          [f.vehicle, f.business, 'S7' + f.vehicle.slice(0, 8).toUpperCase()],
        );
        await setup.query(
          "insert into public.gps_devices(id,business_id,provider,device_uid) values($1,$2,'traccar',$3)",
          [f.device, f.business, 'TEST-retention-' + f.device],
        );
        await setup.query(
          'insert into public.device_assignments(id,business_id,vehicle_id,device_id,assigned_at) values($1,$2,$3,$4,$5)',
          [f.assignment, f.business, f.vehicle, f.device, started],
        );
        for (let i = 0; i < 3; i++)
          await setup.query(
            `insert into public.gps_positions(business_id,assignment_id,device_id,vehicle_id,provider,device_uid,event_key,recorded_at,received_at,latitude,longitude,speed_kph,heading) values($1,$2,$3,$4,'traccar',$5,$6,$7,$8,10.77,106.7,20,90)`,
            [
              f.business,
              f.assignment,
              f.device,
              f.vehicle,
              'TEST-retention-' + f.device,
              randomUUID().replaceAll('-', '') +
                randomUUID().replaceAll('-', ''),
              new Date(old.getTime() + i * 60000),
              old,
            ],
          );
      }
      await setup.query('commit');
    } catch (error) {
      await setup.query('rollback');
      throw error;
    } finally {
      setup.release();
    }
    const a = fixtures[0],
      b = fixtures[1];
    const options = {
      businessId: a.business,
      apply: false,
      batchLimit: 1000,
      maxBatches: 1,
    };
    const dry = await runRetention(pool, options);
    assert.equal(dry.eligible, 2);
    assert.equal(dry.deleted, 0);
    const before = (
      await pool.query<{ count: number }>(
        'select count(*)::int as count from public.gps_positions where business_id=$1',
        [a.business],
      )
    ).rows[0].count;
    assert.equal(before, 3);
    // Hold the exact tenant lock used by ingestion. Retention must wait, then see
    // the newly committed current fix before calculating protected candidates.
    writer = await pool.connect();
    await writer.query('begin');
    await writer.query(
      'select id from public.businesses where id=$1 for update',
      [a.business],
    );
    const maintenance = await pool.connect();
    const pid = (
      await maintenance.query<{ pid: number }>('select pg_backend_pid() as pid')
    ).rows[0].pid;
    waiting = retentionBatch(
      { connect: async () => maintenance },
      { ...options, apply: true },
    ).then(
      (result) => ({ result }),
      (error) => ({ error }),
    );
    let observedLock = false;
    for (let i = 0; i < 20; i++) {
      const result = await pool.query<{ waiting: boolean }>(
        "select coalesce(wait_event_type='Lock',false) as waiting from pg_stat_activity where pid=$1",
        [pid],
      );
      if (result.rows[0]?.waiting) {
        observedLock = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(
      observedLock,
      true,
      'retention must wait for the shared tenant lock',
    );
    const latest = randomUUID();
    await writer.query(
      `insert into public.gps_positions(id,business_id,assignment_id,device_id,vehicle_id,provider,device_uid,event_key,recorded_at,latitude,longitude,speed_kph,heading) values($1,$2,$3,$4,$5,'traccar',$6,$7,clock_timestamp(),10.77,106.7,20,90)`,
      [
        latest,
        a.business,
        a.assignment,
        a.device,
        a.vehicle,
        'TEST-retention-' + a.device,
        randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
      ],
    );
    await writer.query('commit');
    writer.release();
    writer = undefined;
    const outcome = await waiting;
    if (outcome.error) throw outcome.error;
    assert.equal(outcome.result?.deleted, 3);
    const remain = await pool.query<{ id: string }>(
      'select id from public.gps_positions where business_id=$1',
      [a.business],
    );
    assert.deepEqual(
      remain.rows.map((row) => row.id),
      [latest],
    );
    assert.equal(
      (
        await pool.query<{ count: number }>(
          'select count(*)::int as count from public.gps_positions where business_id=$1',
          [b.business],
        )
      ).rows[0].count,
      3,
    );
    // Two simultaneous maintenance jobs serialize; neither may delete the last fix.
    const repeated = await Promise.all([
      retentionBatch(pool, { ...options, apply: true }),
      retentionBatch(pool, { ...options, apply: true }),
    ]);
    assert.equal(
      repeated.reduce((sum, result) => sum + result.deleted, 0),
      0,
    );
    console.log(
      JSON.stringify({
        event: 'gps.retention.verified',
        checks: [
          'dry-run-preserves-rows',
          '30-day-received-cutoff',
          'active-latest-protected',
          'ingest-lock-observed',
          'post-lock-snapshot-protects-new-current',
          'other-tenant-untouched',
          'concurrent-maintenance-idempotent',
        ],
        checksPassed: 7,
        deletedOwnedHistory: 3,
        physicalDeviceVerified: false,
      }),
    );
  } finally {
    if (writer) {
      await writer.query('rollback');
      writer.release();
    }
    if (waiting) await waiting;
    const cleanup = await pool.connect();
    try {
      await cleanup.query('begin');
      const businesses = fixtures.map((f) => f.business);
      await cleanup.query(
        'delete from public.gps_positions where business_id=any($1::uuid[])',
        [businesses],
      );
      await cleanup.query(
        'delete from public.device_assignments where id=any($1::uuid[])',
        [fixtures.map((f) => f.assignment)],
      );
      await cleanup.query(
        'delete from public.gps_devices where id=any($1::uuid[])',
        [fixtures.map((f) => f.device)],
      );
      await cleanup.query(
        'delete from public.vehicles where id=any($1::uuid[])',
        [fixtures.map((f) => f.vehicle)],
      );
      const removed = await cleanup.query(
        'delete from public.businesses where id=any($1::uuid[])',
        [businesses],
      );
      await cleanup.query('commit');
      const remaining = (
        await cleanup.query<{ count: number }>(
          'select count(*)::int as count from public.businesses where id=any($1::uuid[])',
          [businesses],
        )
      ).rows[0].count;
      assert.equal(remaining, 0);
      console.log(
        JSON.stringify({
          event: 'gps.retention.cleanup',
          ownedBusinessesRemoved: removed.rowCount,
          remainingOwnedBusinesses: remaining,
        }),
      );
    } catch {
      await cleanup.query('rollback');
      console.error(JSON.stringify({ event: 'gps.retention.cleanup-failed' }));
      process.exitCode = 1;
    } finally {
      cleanup.release();
      await pool.end();
    }
  }
}
main().catch(() => {
  console.error(JSON.stringify({ event: 'gps.retention.verification-failed' }));
  process.exitCode = 1;
});
