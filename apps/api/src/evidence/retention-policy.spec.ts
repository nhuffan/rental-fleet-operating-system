import {
  retentionBackoff,
  retentionDeadline,
  retentionDeletionEnabled,
  retentionView,
} from './retention-policy.js';
const now = new Date('2026-10-25T00:00:00Z');
const rental = {
  status: 'COMPLETED',
  returnedAt: new Date('2026-09-25T00:00:00Z'),
};
const active = { status: 'ACTIVE', important: false, purgedAt: null };
it('uses exact server-time 30/90-day windows and the inclusive grace boundary', () => {
  expect(retentionDeadline(rental, 30)).toEqual(now);
  expect(
    retentionView(rental, 30, active, null, new Date(+now - 1)).canRead,
  ).toBe(true);
  expect(retentionView(rental, 30, active, null, now)).toMatchObject({
    retentionStatus: 'PURGE_ELIGIBLE',
    canRead: false,
    canProtect: true,
  });
  expect(retentionDeadline(rental, 90)).toEqual(
    new Date('2026-12-24T00:00:00Z'),
  );
});
it('never infers completion from CANCELLED/unfinished/legacy or an invalid completion date', () => {
  for (const value of [
    { ...rental, status: 'CANCELLED' },
    { ...rental, status: 'ACTIVE' },
    { ...rental, status: 'RESERVED' },
    { ...rental, returnedAt: null },
    { ...rental, returnedAt: new Date(NaN) },
  ])
    expect(retentionDeadline(value, 30)).toBeNull();
});
it('important, legal holds and unresolved disputes override deadlines but never revive deleted/uncertain files', () => {
  for (const [life, hold] of [
    [{ ...active, important: true }, null],
    [active, { active: true, unresolvedDispute: false }],
    [active, { active: false, unresolvedDispute: true }],
  ] as const)
    expect(retentionView(rental, 30, life, hold, now)).toMatchObject({
      retentionStatus: 'ACTIVE',
      retentionDeadline: null,
      canRead: true,
    });
  for (const status of ['PURGING', 'PURGED', 'RETRY_REQUIRED'])
    expect(
      retentionView(
        rental,
        30,
        { ...active, status },
        { active: true, unresolvedDispute: true },
        now,
      ),
    ).toMatchObject({ canRead: false, canProtect: false });
  expect(retentionView(rental, 30, null, null, now).canRead).toBe(false);
});
it('requires an explicit enable flag and the exact development project/environment', () => {
  vi.stubEnv('APP_ENV', 'development');
  vi.stubEnv('SUPABASE_URL', 'https://eeryymswcufnebibigqf.supabase.co');
  vi.stubEnv('EVIDENCE_RETENTION_DELETE_ENABLED', 'false');
  expect(retentionDeletionEnabled()).toBe(false);
  vi.stubEnv('EVIDENCE_RETENTION_DELETE_ENABLED', 'true');
  expect(retentionDeletionEnabled()).toBe(true);
  for (const env of ['production', 'staging', 'test']) {
    vi.stubEnv('APP_ENV', env);
    expect(retentionDeletionEnabled()).toBe(false);
  }
  vi.stubEnv('APP_ENV', 'development');
  vi.stubEnv('SUPABASE_URL', 'https://other.supabase.co');
  expect(retentionDeletionEnabled()).toBe(false);
  vi.unstubAllEnvs();
});
it('allows staging/production deletion only with the flag and a matching typed project confirmation', () => {
  vi.stubEnv('SUPABASE_URL', 'https://prodref123.supabase.co');
  vi.stubEnv('EVIDENCE_RETENTION_DELETE_ENABLED', 'true');
  for (const env of ['staging', 'production']) {
    vi.stubEnv('APP_ENV', env);
    vi.stubEnv('EVIDENCE_RETENTION_DELETE_CONFIRM', '');
    expect(retentionDeletionEnabled()).toBe(false);
    vi.stubEnv('EVIDENCE_RETENTION_DELETE_CONFIRM', 'otherref');
    expect(retentionDeletionEnabled()).toBe(false);
    vi.stubEnv('EVIDENCE_RETENTION_DELETE_CONFIRM', 'prodref123');
    expect(retentionDeletionEnabled()).toBe(true);
    vi.stubEnv('EVIDENCE_RETENTION_DELETE_ENABLED', 'false');
    expect(retentionDeletionEnabled()).toBe(false);
    vi.stubEnv('EVIDENCE_RETENTION_DELETE_ENABLED', 'true');
  }
  vi.stubEnv('APP_ENV', 'test');
  expect(retentionDeletionEnabled()).toBe(false);
  vi.unstubAllEnvs();
});
it('bounds exponential retry backoff at one day', () => {
  expect(retentionBackoff(1)).toBe(60_000);
  expect(retentionBackoff(2)).toBe(120_000);
  expect(retentionBackoff(1000)).toBe(86_400_000);
});
