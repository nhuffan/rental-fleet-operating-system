import type { Pool } from 'pg';
import { createPool } from '../../src/database/database.js';
import { assertDevelopmentMaintenance } from './maintenance.js';
import {
  retentionOptions,
  runRetention,
} from '../../src/telematics/operations/retention.js';
// A scheduler may invoke this bounded, one-shot command later. It never installs
// cron, loops forever or expands beyond the explicitly selected development tenant.
async function main() {
  let pool: Pool | undefined;
  try {
    if (process.argv.length === 3 && process.argv[2] === '--help') {
      console.log(
        'gps:retention --business=<uuid> [--dry-run|--apply] [--batch-limit=1..1000] [--max-batches=1..10]',
      );
      return;
    }
    assertDevelopmentMaintenance();
    const options = retentionOptions(process.argv.slice(2));
    pool = createPool();
    console.log(JSON.stringify(await runRetention(pool, options)));
  } catch {
    console.error(JSON.stringify({ event: 'gps.retention.failed' }));
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
await main();
