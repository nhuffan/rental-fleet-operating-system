export const IMAGE_BUCKET = 'inspection-images';
export const VIDEO_BUCKET = 'inspection-videos';
export const IMAGE_MAX_BYTES = 1024 * 1024;
export const VIDEO_MAX_BYTES = 12 * 1024 * 1024;
export const WORKFLOW_TTL_MS = 15 * 60_000;
// Supabase signed-upload capabilities last two hours. Keep pending objects and
// their quota until that capability plus a five-minute grace period has expired.
export const UPLOAD_HOLD_MS = 125 * 60_000;
export const VERIFY_LEASE_MS = 60_000;
export const READ_TTL_SECONDS = 60;
function integer(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error(`Invalid ${name}`);
  return value;
}
export function evidenceLimits() {
  return {
    maxImages: integer('EVIDENCE_MAX_IMAGES', 8, 1, 8),
    maxVideos: integer('EVIDENCE_MAX_VIDEOS', 1, 0, 1),
    maxInspectionBytes: integer(
      'EVIDENCE_MAX_INSPECTION_BYTES',
      20 * 1024 * 1024,
      IMAGE_MAX_BYTES,
      20 * 1024 * 1024,
    ),
    maxTenantBytes: integer(
      'EVIDENCE_MAX_TENANT_BYTES',
      128 * 1024 * 1024,
      24 * 1024 * 1024,
      1024 * 1024 * 1024,
    ),
    maxConcurrentUploads: integer('EVIDENCE_MAX_CONCURRENT_UPLOADS', 3, 1, 3),
    maxImageBytes: IMAGE_MAX_BYTES,
    maxVideoBytes: VIDEO_MAX_BYTES,
    maxVideoSeconds: 30,
  };
}
export const mediaCap = (kind: string) =>
  kind === 'IMAGE' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
