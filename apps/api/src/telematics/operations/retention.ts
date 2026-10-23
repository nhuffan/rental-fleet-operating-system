export const RETENTION_DAYS = 30;
export const RETENTION_BATCH_CAP = 1000;
export const RETENTION_RUN_BATCH_CAP = 10;
export type RetentionOptions = {
  businessId: string;
  apply: boolean;
  batchLimit: number;
  maxBatches: number;
};
export interface MaintenanceConnection {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount?: number | null }>;
  release(): void;
}
export interface MaintenanceDatabase {
  connect(): Promise<MaintenanceConnection>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function retentionOptions(args: string[]): RetentionOptions {
  const accepted =
    /^(?:--business=[0-9a-fA-F-]+|--batch-limit=\d+|--max-batches=\d+|--apply|--dry-run)$/;
  if (
    args.some((arg) => !accepted.test(arg)) ||
    new Set(args.map((arg) => arg.split('=')[0])).size !== args.length
  )
    throw new Error(
      'Use --business=<uuid> [--dry-run|--apply] [--batch-limit=1..1000] [--max-batches=1..10]',
    );
  if (args.includes('--apply') && args.includes('--dry-run'))
    throw new Error('Choose --dry-run or --apply');
  const value = (name: string) =>
    args.find((arg) => arg.startsWith(name + '='))?.slice(name.length + 1);
  const options = {
    businessId: value('--business') ?? '',
    apply: args.includes('--apply'),
    batchLimit: Number(value('--batch-limit') ?? RETENTION_BATCH_CAP),
    maxBatches: Number(value('--max-batches') ?? 1),
  };
  validateOptions(options);
  return options;
}
function validateOptions(options: RetentionOptions) {
  if (
    !uuid.test(options.businessId) ||
    !Number.isInteger(options.batchLimit) ||
    options.batchLimit < 1 ||
    options.batchLimit > RETENTION_BATCH_CAP ||
    !Number.isInteger(options.maxBatches) ||
    options.maxBatches < 1 ||
    options.maxBatches > RETENTION_RUN_BATCH_CAP
  )
    throw new Error('Invalid tenant or retention batch limits');
}
// Keep exactly the same recorded/first-received/id ordering as current location.
// Every lookup remains tenant-scoped, including the correlated protected latest fix.
export const retentionCandidatesSql = `select p.id from public.gps_positions p
 where p.business_id=$1 and p.received_at<$2 and not exists (
  select 1 from public.device_assignments a where a.business_id=p.business_id and a.id=p.assignment_id and a.unassigned_at is null
   and p.id=(select l.id from public.gps_positions l where l.business_id=a.business_id and l.assignment_id=a.id order by l.recorded_at desc,l.received_at asc,l.id asc limit 1)
 ) order by p.received_at,p.id limit $3`;
export async function retentionBatch(
  database: MaintenanceDatabase,
  options: RetentionOptions,
) {
  validateOptions(options);
  const tx = await database.connect();
  try {
    await tx.query(options.apply ? 'begin' : 'begin read only');
    await tx.query("set local lock_timeout='2s'");
    await tx.query("set local statement_timeout='10s'");
    // Same lock/order as ingestion and assignment lifecycle; overlapping invocations
    // cannot race the protection query or delete a newly current point.
    const business = await tx.query(
      options.apply
        ? 'select id from public.businesses where id=$1 for update'
        : 'select id from public.businesses where id=$1',
      [options.businessId],
    );
    if (!business.rows.length)
      throw new Error('Retention tenant does not exist');
    const { cutoff } = (
      await tx.query<{ cutoff: Date }>(
        "select clock_timestamp()-interval '30 days' as cutoff",
      )
    ).rows[0];
    const candidates = await tx.query<{ id: string }>(retentionCandidatesSql, [
      options.businessId,
      cutoff,
      options.batchLimit,
    ]);
    let deleted = 0;
    if (options.apply && candidates.rows.length) {
      const result = await tx.query(
        'delete from public.gps_positions where business_id=$1 and id=any($2::uuid[])',
        [options.businessId, candidates.rows.map((row) => row.id)],
      );
      deleted = result.rowCount ?? 0;
    }
    await tx.query('commit');
    return {
      eligible: candidates.rows.length,
      deleted,
      cutoff: cutoff.toISOString(),
      batchLimit: options.batchLimit,
      capped: candidates.rows.length === options.batchLimit,
    };
  } catch (error) {
    await tx.query('rollback');
    throw error;
  } finally {
    tx.release();
  }
}
export async function runRetention(
  database: MaintenanceDatabase,
  options: RetentionOptions,
) {
  validateOptions(options);
  let eligible = 0,
    deleted = 0,
    batches = 0,
    capped = false;
  let cutoff = '';
  // Dry-run never repeats the same candidate page or claims an unbounded count.
  const batchCount = options.apply ? options.maxBatches : 1;
  for (; batches < batchCount;) {
    const result = await retentionBatch(database, options);
    batches++;
    eligible += result.eligible;
    deleted += result.deleted;
    cutoff = result.cutoff;
    capped = result.capped;
    if (!capped) break;
  }
  return {
    event: 'gps.retention.complete',
    mode: options.apply ? 'apply' : 'dry-run',
    retentionDays: RETENTION_DAYS,
    eligible,
    deleted,
    batches,
    batchLimit: options.batchLimit,
    maxBatches: options.maxBatches,
    capped,
    cutoff,
  };
}
