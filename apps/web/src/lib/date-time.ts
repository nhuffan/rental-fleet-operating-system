// datetime-local has no zone. These forms explicitly use Vietnam time, not the browser's time zone.
export function localDateTime(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return parts.replace(" ", "T");
}
export function utcDateTime(value: string) {
  const date = new Date(`${value}:00+07:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
