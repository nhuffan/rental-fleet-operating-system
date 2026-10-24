export const mediaLimits = {
  maxImages: 8,
  maxVideos: 1,
  maxImageBytes: 1024 * 1024,
  maxVideoBytes: 12 * 1024 * 1024,
  maxInspectionBytes: 20 * 1024 * 1024,
  maxVideoSeconds: 30,
} as const;
export type MediaKind = "IMAGE" | "VIDEO";
export const videoMimeCandidates = [
  'video/mp4;codecs="avc1.42E01E"',
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;
export function videoEncoder(supported: (mime: string) => boolean) {
  return videoMimeCandidates.find(supported) ?? null;
}
export function fittedSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight = maxWidth,
) {
  const ratio = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
  };
}
export function originalVideoAllowed(
  bytes: number,
  seconds: number,
  width: number,
  height: number,
  mime: string,
) {
  return (
    bytes > 0 &&
    bytes <= mediaLimits.maxVideoBytes &&
    Number.isFinite(seconds) &&
    seconds > 0 &&
    seconds <= mediaLimits.maxVideoSeconds &&
    width > 0 &&
    height > 0 &&
    Math.max(width, height) <= 1920 &&
    Math.min(width, height) <= 1080 &&
    ["video/mp4", "video/webm"].includes(mime)
  );
}
export function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
