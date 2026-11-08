// Pure helpers (no path aliases) so the node test runner can import them directly.
export const REPORT_EXPORT_KINDS = [
  "vehicles",
  "customers",
  "rentals",
  "movements",
] as const;
export type ReportExportKind = (typeof REPORT_EXPORT_KINDS)[number];
export const exportLabels: Record<ReportExportKind, string> = {
  vehicles: "Danh sách xe",
  customers: "Danh sách khách hàng",
  rentals: "Hợp đồng thuê trong kỳ",
  movements: "Giao dịch thu chi trong kỳ",
};
const DAY = 86_400_000;
const zone = "Asia/Ho_Chi_Minh";
type Params = Record<string, string | string[] | undefined>;

function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isFinite(date.getTime()) && vietnamDay(date) === value
    ? value
    : "";
}
export function vietnamDay(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 10) : "";
}
// Default period is the last 30 Vietnam calendar days including today.
export function reportFilters(params: Params, now = new Date()) {
  const until = validDay(single(params.until)) || vietnamDay(now);
  const from =
    validDay(single(params.from)) ||
    vietnamDay(new Date(new Date(`${until}T00:00:00+07:00`).getTime() - 29 * DAY));
  return from <= until
    ? { from, until }
    : { from: until, until: from };
}
export type ReportFilters = ReturnType<typeof reportFilters>;
// `until` is inclusive in the UI and exclusive on the API (next Vietnam midnight).
export function apiRange(filters: ReportFilters) {
  return {
    from: new Date(`${filters.from}T00:00:00+07:00`).toISOString(),
    until: new Date(
      new Date(`${filters.until}T00:00:00+07:00`).getTime() + DAY,
    ).toISOString(),
  };
}
export function exportHref(kind: ReportExportKind, filters: ReportFilters) {
  return `/app/reports/export/${kind}?from=${filters.from}&until=${filters.until}`;
}
export function isExportKind(value: string): value is ReportExportKind {
  return (REPORT_EXPORT_KINDS as readonly string[]).includes(value);
}
export function percent(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)}%`;
}
export function monthLabel(month: string) {
  const [year, number] = month.split("-");
  return `Tháng ${Number(number)}/${year}`;
}
export const rentalStatusLabels: Record<string, string> = {
  DRAFT: "Nháp",
  RESERVED: "Đã giữ chỗ",
  ACTIVE: "Đang thuê",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
