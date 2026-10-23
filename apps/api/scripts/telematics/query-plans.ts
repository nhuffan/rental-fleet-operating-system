import { createPool } from '../../src/database/database.js';
import { retentionCandidatesSql } from '../../src/telematics/operations/retention.js';
import { assertDevelopmentMaintenance } from './maintenance.js';
const latest = `select v.id,p.id from public.vehicles v
 left join public.device_assignments a on a.business_id=v.business_id and a.vehicle_id=v.id and a.unassigned_at is null
 left join lateral (select pos.id from public.gps_positions pos where pos.business_id=v.business_id and pos.assignment_id=a.id order by pos.recorded_at desc,pos.received_at asc,pos.id asc limit 1) p on true where v.business_id=$1 order by v.license_plate,v.id limit 20`;
const history = `select p.id,p.vehicle_id,p.assignment_id,p.device_id,p.recorded_at,p.received_at,p.latitude,p.longitude,p.speed_kph,p.heading,p.ignition,p.source_mode,v.license_plate,a.assigned_at,a.unassigned_at from public.gps_positions p
 join public.vehicles v on v.business_id=p.business_id and v.id=p.vehicle_id
 join public.device_assignments a on a.business_id=p.business_id and a.id=p.assignment_id and a.vehicle_id=p.vehicle_id and a.device_id=p.device_id
 where p.business_id=$1 and ($2::uuid is null or p.vehicle_id=$2) and p.recorded_at>=$3 and p.recorded_at<$4 and p.recorded_at>=a.assigned_at and (a.unassigned_at is null or p.recorded_at<a.unassigned_at)
 order by p.recorded_at,p.received_at,p.id limit 10001`;
type Plan = {
  'Node Type': string;
  'Index Name'?: string;
  'Actual Rows': number;
  'Actual Loops': number;
  Plans?: Plan[];
};
function summary(result: {
  'Execution Time': number;
  'Planning Time': number;
  Plan: Plan;
}) {
  const indexes = new Set<string>();
  let scans = 0;
  function visit(plan: Plan) {
    if (plan['Index Name']) indexes.add(plan['Index Name']);
    if (plan['Node Type'] === 'Seq Scan') scans++;
    plan.Plans?.forEach(visit);
  }
  visit(result.Plan);
  return {
    executionMs: result['Execution Time'],
    planningMs: result['Planning Time'],
    returnedRows: result.Plan['Actual Rows'],
    indexes: [...indexes],
    sequentialScans: scans,
  };
}
async function main() {
  assertDevelopmentMaintenance();
  if (process.argv.length > 2)
    throw new Error('This command takes no arguments');
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("set local statement_timeout='20s'");
    const { business } =
      (
        await client.query<{ business: string }>(
          'select id as business from public.businesses order by created_at,id limit 1',
        )
      ).rows[0] ?? {};
    if (!business) throw new Error('Development database has no business');
    const now = new Date(),
      cutoff = new Date(now.getTime() - 30 * 86400000),
      from = new Date(now.getTime() - 7 * 86400000);
    async function measure(
      dataset: string,
      schema: 'public' | 'pg_temp',
      businessId: string,
      vehicleId: string | null,
    ) {
      for (const [name, sql, params] of [
        ['retention', retentionCandidatesSql, [businessId, cutoff, 1000]],
        ['current-latest', latest, [businessId]],
        ['trip-tenant-range', history, [businessId, null, from, now]],
        ['trip-vehicle-range', history, [businessId, vehicleId, from, now]],
      ] as const) {
        const query =
          schema === 'public' ? sql : sql.replaceAll('public.', 'pg_temp.');
        const result = await client.query<{
          'QUERY PLAN': {
            'Execution Time': number;
            'Planning Time': number;
            Plan: Plan;
          }[];
        }>('explain (analyze,buffers,format json) ' + query, [...params]);
        console.log(
          JSON.stringify({
            event: 'gps.query-plan',
            dataset,
            query: name,
            ...summary(result.rows[0]['QUERY PLAN'][0]),
          }),
        );
      }
    }
    const vehicle =
      (
        await client.query<{ id: string }>(
          'select id from public.vehicles where business_id=$1 order by id limit 1',
          [business],
        )
      ).rows[0]?.id ?? null;
    const count = (
      await client.query<{ count: number }>(
        'select count(*)::int as count from public.gps_positions',
      )
    ).rows[0].count;
    console.log(
      JSON.stringify({
        event: 'gps.query-plan.dataset',
        dataset: 'development',
        totalPositions: count,
      }),
    );
    await measure('development', 'public', business, vehicle);
    // Session-local clones preserve the real table columns/checks/index definitions.
    // No application rows, schema or persistent statistics are changed.
    for (const table of ['vehicles', 'device_assignments', 'gps_positions'])
      await client.query(
        `create temp table ${table} (like public.${table} including all) on commit drop`,
      );
    await client.query(
      'create temp table plan_ids on commit drop as select i,gen_random_uuid() as business_id from generate_series(1,10) i',
    );
    await client.query(
      `insert into pg_temp.vehicles(id,business_id,license_plate,make,model) select gen_random_uuid(),b.business_id,'PLAN'||b.i||'V'||v,'TEST','synthetic' from plan_ids b cross join generate_series(1,5) v`,
    );
    await client.query(
      "insert into pg_temp.device_assignments(id,business_id,vehicle_id,device_id,assigned_at) select gen_random_uuid(),business_id,id,gen_random_uuid(),now()-interval '60 days' from pg_temp.vehicles",
    );
    await client.query(`insert into pg_temp.gps_positions(business_id,assignment_id,device_id,vehicle_id,provider,device_uid,event_key,recorded_at,received_at,latitude,longitude,speed_kph,heading)
      select a.business_id,a.id,a.device_id,a.vehicle_id,'traccar','TEST-PLAN',md5(a.id::text||n)||md5(n::text||a.id),now()-n*interval '10 seconds',now()-interval '40 days',10.77,106.7+n*0.000001,20,90 from pg_temp.device_assignments a cross join generate_series(1,1000) n`);
    for (const table of ['vehicles', 'device_assignments', 'gps_positions'])
      await client.query(`analyze pg_temp.${table}`);
    const synthetic = (
      await client.query<{ business_id: string; id: string }>(
        'select business_id,id from pg_temp.vehicles order by id limit 1',
      )
    ).rows[0];
    console.log(
      JSON.stringify({
        event: 'gps.query-plan.dataset',
        dataset: 'synthetic-temp',
        totalPositions: 50000,
        tenants: 10,
        vehicles: 50,
        positionsPerTenant: 5000,
      }),
    );
    await measure(
      'synthetic-temp',
      'pg_temp',
      synthetic.business_id,
      synthetic.id,
    );
    await client.query('rollback');
    console.log(
      JSON.stringify({
        event: 'gps.query-plan.cleanup',
        rolledBack: true,
        persistentRowsWritten: 0,
      }),
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(() => {
  console.error(JSON.stringify({ event: 'gps.query-plan.failed' }));
  process.exitCode = 1;
});
