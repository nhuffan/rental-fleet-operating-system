import { FEATURE_CATALOG, integrationStatus, systemLimits } from './system.js';

describe('platform system status projection', () => {
  const secrets = {
    SUPABASE_URL: 'https://abcdefghij.supabase.co',
    SUPABASE_SECRET_KEY: 'SECRET-KEY-VALUE-123',
    DATABASE_URL: 'postgresql://postgres.x:DB-PASSWORD-456@host/db',
    GPS_TRACCAR_TOKEN: 'T'.repeat(40),
    EVIDENCE_RETENTION_DELETE_ENABLED: 'true',
  };
  it('exposes only booleans, host names and fixed limits — never secret values', () => {
    const json = JSON.stringify([
      integrationStatus(secrets),
      FEATURE_CATALOG,
      systemLimits(),
    ]);
    for (const secret of [
      'SECRET-KEY-VALUE-123',
      'DB-PASSWORD-456',
      'T'.repeat(40),
      'postgresql://',
    ])
      expect(json).not.toContain(secret);
    expect(json).toContain('abcdefghij.supabase.co');
  });
  it('reports missing configuration honestly', () => {
    const byKey = Object.fromEntries(
      integrationStatus({ GPS_TRACCAR_TOKEN: 'short' }).map((i) => [i.key, i]),
    );
    expect(byKey.supabase_auth_db.status).toBe('NOT_CONFIGURED');
    expect(byKey.supabase_admin.status).toBe('NOT_CONFIGURED');
    expect(byKey.traccar_gps.status).toBe('NOT_CONFIGURED');
    const configured = Object.fromEntries(
      integrationStatus(secrets).map((i) => [i.key, i]),
    );
    expect(configured.traccar_gps.status).toBe('TEST_ONLY');
    expect(configured.supabase_admin.status).toBe('CONFIGURED');
    expect(configured.evidence_storage.detail).toContain('đang được bật');
  });
  it('labels unimplemented features as not implemented and GPS as TEST', () => {
    const status = Object.fromEntries(
      FEATURE_CATALOG.map((f) => [f.key, f.status]),
    );
    expect(status).toMatchObject({
      gps: 'TEST',
      customer_portal: 'NOT_IMPLEMENTED',
      online_payments: 'NOT_IMPLEMENTED',
      reports: 'AVAILABLE',
    });
  });
});
