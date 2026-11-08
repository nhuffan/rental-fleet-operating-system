import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export function loadConfig() {
  if (existsSync('.env')) loadEnvFile('.env');
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
  };
  const url = new URL(required('SUPABASE_URL'));
  const db = new URL(required('DATABASE_URL'));
  if (!['postgres:', 'postgresql:'].includes(db.protocol))
    throw new Error('DATABASE_URL must use PostgreSQL');
  if ([...db.searchParams.keys()].some((key) => key.startsWith('ssl')))
    throw new Error(
      'Configure TLS through DATABASE_CA_PATH, not DATABASE_URL query parameters',
    );
  if (url.hostname.endsWith('.supabase.co')) {
    const ref = url.hostname.split('.')[0];
    if (
      db.hostname.endsWith('.pooler.supabase.com')
        ? decodeURIComponent(db.username) !== 'postgres.' + ref
        : db.hostname !== 'db.' + ref + '.supabase.co'
    )
      throw new Error(
        'DATABASE_URL and SUPABASE_URL must refer to the same project',
      );
  }
  const port = Number(process.env.PORT ?? 9000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid PORT');
  const environment = required('APP_ENV');
  if (!['development', 'test', 'staging', 'production'].includes(environment))
    throw new Error('Invalid APP_ENV');
  const origin = required('WEB_ORIGIN');
  if (new URL(origin).origin !== origin)
    throw new Error('WEB_ORIGIN must be an origin without trailing slash');
  if (
    ['staging', 'production'].includes(environment) &&
    (url.protocol !== 'https:' || !origin.startsWith('https://'))
  )
    throw new Error('Staging/production requires HTTPS');
  if (['staging', 'production'].includes(environment)) {
    if (process.env.ALLOW_DEMO_SEED === 'true')
      throw new Error('ALLOW_DEMO_SEED must not be enabled in staging/production');
    if (!process.env.SUPABASE_SECRET_KEY)
      throw new Error(
        'SUPABASE_SECRET_KEY is required in staging/production',
      );
  }
  const rateLimitPerMinute = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 300);
  if (
    !Number.isInteger(rateLimitPerMinute) ||
    rateLimitPerMinute < 10 ||
    rateLimitPerMinute > 100_000
  )
    throw new Error('Invalid RATE_LIMIT_PER_MINUTE');
  const caPath = process.env.DATABASE_CA_PATH
    ? resolve(process.env.DATABASE_CA_PATH)
    : fileURLToPath(
        new URL('../../../infra/certs/supabase-ca.crt', import.meta.url),
      );
  return {
    port,
    environment,
    host: process.env.HOST ?? '127.0.0.1',
    origin,
    rateLimitPerMinute,
    trustProxy: process.env.TRUST_PROXY === 'true',
    supabaseUrl: url.toString().replace(/\/$/, ''),
    publishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
    databaseUrl: db.toString(),
    ca: readFileSync(caPath, 'utf8'),
  };
}
export type AppConfig = ReturnType<typeof loadConfig>;
