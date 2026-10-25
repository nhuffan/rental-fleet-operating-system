import 'reflect-metadata';
import { isUUID } from 'class-validator';
import { loadConfig } from '../src/config.js';
import { Database } from '../src/database/database.js';
import { EvidenceRetentionWorker } from '../src/evidence/retention-worker.js';
async function main() {
  const config = loadConfig();
  const ref = new URL(config.supabaseUrl).hostname.split('.')[0];
  if (
    config.environment !== 'development' ||
    ref !== 'eeryymswcufnebibigqf' ||
    ref !== process.env.SUPABASE_PROJECT_REF
  )
    throw new Error(
      'Retention maintenance is restricted to the exact development project',
    );
  const args = process.argv.slice(2);
  if (
    args.some(
      (arg) =>
        arg !== '--apply' &&
        !arg.startsWith('--limit=') &&
        !arg.startsWith('--business='),
    )
  )
    throw new Error('Use optional --apply --limit=1..100 --business=UUID');
  const limit = Number(
    args.find((arg) => arg.startsWith('--limit='))?.slice(8) ?? 20,
  );
  const businessId = args
    .find((arg) => arg.startsWith('--business='))
    ?.slice(11);
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (businessId && !isUUID(businessId))
  )
    throw new Error('Invalid retention maintenance arguments');
  const database = new Database();
  try {
    const result = await new EvidenceRetentionWorker(database).runBatch({
      apply: args.includes('--apply'),
      limit,
      businessId,
    });
    console.log(JSON.stringify(result));
    if (result.failed || result.retryRequired) process.exitCode = 1;
  } finally {
    await database.onModuleDestroy();
  }
}
main().catch(() => {
  console.error(
    'Retention maintenance failed. Deletion is disabled unless explicitly enabled on the development project; inspect server configuration and retry safely.',
  );
  process.exitCode = 1;
});
