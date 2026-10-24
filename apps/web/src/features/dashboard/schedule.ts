const day = 86400000;
const vietnamOffset = 7 * 3600000;

// Operational calendar boundaries are always UTC+7, independent of browser timezone.
export function operationalDayStart(timestamp: number) {
  return Math.floor((timestamp + vietnamOffset) / day) * day - vietnamOffset;
}
export function scheduleWindow(
  anchor: number,
  mode: "day" | "week",
  offset = 0,
) {
  const duration = (mode === "week" ? 7 : 1) * day;
  const start = operationalDayStart(anchor) + offset * duration;
  return { start, end: start + duration, duration };
}
export function intervalPosition(
  startAt: string,
  endAt: string,
  window: { start: number; end: number; duration: number },
) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (start >= window.end || end <= window.start || end <= start) return null;
  const left = (Math.max(window.start, start) - window.start) / window.duration;
  const right = (Math.min(window.end, end) - window.start) / window.duration;
  return { left: left * 100, width: (right - left) * 100 };
}
