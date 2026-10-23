import { loadConfig } from '../../src/config.js';
export function assertDevelopmentMaintenance() {
  const config = loadConfig();
  if (
    config.environment !== 'development' ||
    new URL(config.supabaseUrl).hostname !== 'eeryymswcufnebibigqf.supabase.co'
  )
    throw new Error(
      'Telemetry maintenance is restricted to the verified development project',
    );
  return config;
}
