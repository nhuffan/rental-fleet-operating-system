export type SearchParams = Record<string, string | string[] | undefined>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validId(value: string) {
  return uuid.test(value);
}
export function text(value: string | string[] | undefined, max = 100) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export function pageNumber(value: string | string[] | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 1000000 ? n : 1;
}
export function queryString(values: Record<string, string | number>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== "") query.set(key, String(value));
  return query.toString();
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
