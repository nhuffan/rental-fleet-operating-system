import { createPool } from '../../src/database/database.js';
import { loadConfig } from '../../src/config.js';
// Explicit, bounded maintenance command. Keep one last-known point for each active
// assignment even when offline >30 days; all other history expires after 30 days.
const config = loadConfig();
if (
  config.environment !== 'development' ||
  new URL(config.supabaseUrl).hostname !== 'eeryymswcufnebibigqf.supabase.co'
)
  throw new Error('PoC maintenance is development-only');
const business = process.argv
  .find((x) => x.startsWith('--business='))
  ?.slice(11);
if (!business || !/^[0-9a-f-]{36}$/i.test(business))
  throw new Error('Pass --business=<verified tenant UUID>');
const apply = process.argv.includes('--apply');
const pool = createPool();
try {
  const result = await pool.query<{ id: string }>(
    `select p.id from public.gps_positions p where p.business_id=$1 and p.received_at<clock_timestamp()-interval '30 days' and not exists (
  select 1 from public.device_assignments a where a.business_id=p.business_id and a.id=p.assignment_id and a.unassigned_at is null and p.id=(select l.id from public.gps_positions l where l.business_id=a.business_id and l.assignment_id=a.id order by l.recorded_at desc,l.received_at asc,l.id asc limit 1)
 ) order by p.received_at,p.id limit 1000`,
    [business],
  );
  if (apply && result.rows.length)
    await pool.query(
      'delete from public.gps_positions where business_id=$1 and id=any($2::uuid[])',
      [business, result.rows.map((x) => x.id)],
    );
  console.log(
    JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      eligible: result.rows.length,
      batchLimit: 1000,
    }),
  );
} finally {
  await pool.end();
}
