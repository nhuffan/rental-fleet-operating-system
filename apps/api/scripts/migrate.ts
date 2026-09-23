import { spawnSync } from 'node:child_process';
import { loadConfig } from '../src/config.js';
const config = loadConfig();
const ref = new URL(config.supabaseUrl).hostname.split('.')[0];
if (ref !== process.env.SUPABASE_PROJECT_REF)
  throw new Error('SUPABASE_PROJECT_REF must match SUPABASE_URL');
const databaseUrl = new URL(config.databaseUrl);
const result = spawnSync('supabase', ['link', '--project-ref', ref, '--yes'], {
  cwd: '../..',
  env: {
    ...process.env,
    SUPABASE_DB_PASSWORD: decodeURIComponent(databaseUrl.password),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
});
if (result.status !== 0)
  throw new Error(
    'Supabase link failed. Check CLI login, project ref and database credentials.',
  );
const push = spawnSync(
  'supabase',
  [
    'db',
    'push',
    '--linked',
    '--yes',
    ...(process.argv.includes('--dry-run') ? ['--dry-run'] : []),
  ],
  {
    cwd: '../..',
    env: {
      ...process.env,
      SUPABASE_DB_PASSWORD: decodeURIComponent(databaseUrl.password),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  },
);
if (push.status !== 0)
  throw new Error(
    'Migration failed. Review migration SQL and CLI authentication. No credentials logged.',
  );
console.log(
  push.stdout
    .replaceAll(config.databaseUrl, '[REDACTED]')
    .replaceAll(decodeURIComponent(databaseUrl.password), '[REDACTED]'),
);
