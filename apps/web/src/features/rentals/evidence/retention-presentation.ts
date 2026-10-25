export type MediaRetentionStatus =
  "ACTIVE" | "PURGE_ELIGIBLE" | "PURGING" | "PURGED" | "RETRY_REQUIRED";
export const retentionLabels: Record<MediaRetentionStatus, string> = {
  ACTIVE: "Đang lưu",
  PURGE_ELIGIBLE: "Hết hạn lưu · Chờ xử lý",
  PURGING: "Đang xử lý xóa",
  PURGED: "Đã xóa vĩnh viễn",
  RETRY_REQUIRED: "Đang chờ xử lý lại",
};
// Fail closed when either the server flag or lifecycle state prevents access.
// A stale or inconsistent response must never mount a purged-file preview.
export function readableMedia(item: {
  retentionStatus: string;
  canRead: boolean;
}) {
  return item.canRead === true && item.retentionStatus === "ACTIVE";
}
export function protectableMedia(item: {
  retentionStatus: string;
  canProtect: boolean;
}) {
  return (
    item.canProtect === true &&
    ["ACTIVE", "PURGE_ELIGIBLE"].includes(item.retentionStatus)
  );
}
