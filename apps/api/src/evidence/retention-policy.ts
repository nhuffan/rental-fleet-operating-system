export const RETENTION_STATUSES = [
  'ACTIVE',
  'PURGE_ELIGIBLE',
  'PURGING',
  'PURGED',
  'RETRY_REQUIRED',
] as const;
export type RetentionStatus = (typeof RETENTION_STATUSES)[number];
export type RetentionRental = { status: string; returnedAt: Date | null };
export type RetentionLifecycle = {
  status: string;
  important: boolean;
  purgedAt: Date | null;
};
export type RetentionHold = { active: boolean; unresolvedDispute: boolean };
export function retentionDeletionEnabled(): boolean {
  try {
    return (
      process.env.EVIDENCE_RETENTION_DELETE_ENABLED === 'true' &&
      process.env.APP_ENV === 'development' &&
      new URL(process.env.SUPABASE_URL ?? '').hostname ===
        'eeryymswcufnebibigqf.supabase.co'
    );
  } catch {
    return false;
  }
}
export function retentionDeadline(
  rental: RetentionRental,
  days: number,
): Date | null {
  if (
    ![30, 90].includes(days) ||
    rental.status !== 'COMPLETED' ||
    !rental.returnedAt ||
    !Number.isFinite(rental.returnedAt.getTime())
  )
    return null;
  return new Date(rental.returnedAt.getTime() + days * 86_400_000);
}
export function retentionView(
  rental: RetentionRental,
  days: number,
  lifecycle: RetentionLifecycle | null | undefined,
  hold: RetentionHold | null | undefined,
  now: Date,
) {
  const important = lifecycle?.important ?? false;
  const legalHold = !!(hold?.active || hold?.unresolvedDispute);
  const deadline =
    important || legalHold ? null : retentionDeadline(rental, days);
  const expired = !!deadline && deadline <= now;
  const unsafe =
    !lifecycle || !['ACTIVE', 'PURGE_ELIGIBLE'].includes(lifecycle.status);
  const status: RetentionStatus = unsafe
    ? lifecycle &&
      ['PURGING', 'PURGED', 'RETRY_REQUIRED'].includes(lifecycle.status)
      ? (lifecycle.status as RetentionStatus)
      : 'RETRY_REQUIRED'
    : expired
      ? 'PURGE_ELIGIBLE'
      : 'ACTIVE';
  return {
    retentionStatus: status,
    retentionDeadline: deadline,
    important,
    legalHold,
    unresolvedDispute: !!hold?.unresolvedDispute,
    purgedAt: lifecycle?.purgedAt ?? null,
    canRead: !unsafe && !expired,
    canProtect: !unsafe,
  };
}
export function retentionBackoff(attempt: number): number {
  return Math.min(
    24 * 60 * 60_000,
    60_000 * 2 ** Math.min(11, Math.max(0, attempt - 1)),
  );
}
