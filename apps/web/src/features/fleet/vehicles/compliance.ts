// Pure helpers (no path aliases) so the node test runner can import them directly.
export const COMPLIANCE_WARNING_DAYS = 30;
export type ComplianceState = "NONE" | "OK" | "DUE_SOON" | "OVERDUE";
export const serviceKindLabels = {
  MAINTENANCE: "Bảo dưỡng",
  REGISTRATION: "Đăng kiểm",
  INSURANCE: "Bảo hiểm",
} as const;
export type ServiceKind = keyof typeof serviceKindLabels;
export const dueLabels: Record<ServiceKind, string> = {
  MAINTENANCE: "Bảo dưỡng tiếp theo",
  REGISTRATION: "Hạn đăng kiểm",
  INSURANCE: "Hạn bảo hiểm",
};
export function vietnamToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
const dayNumber = (value: string) => Date.parse(`${value}T00:00:00Z`) / 86_400_000;
// Mirrors the API alert rule: overdue when before today, warning within 30 days.
export function complianceState(
  due: string | null | undefined,
  today: string,
): { state: ComplianceState; days: number | null } {
  if (!due) return { state: "NONE", days: null };
  const days = dayNumber(due) - dayNumber(today);
  if (days < 0) return { state: "OVERDUE", days };
  return { state: days <= COMPLIANCE_WARNING_DAYS ? "DUE_SOON" : "OK", days };
}
export function complianceText(state: ComplianceState, days: number | null) {
  if (state === "NONE" || days === null) return "Chưa khai báo";
  if (state === "OVERDUE") return `Đã quá hạn ${Math.abs(days)} ngày`;
  return days === 0 ? "Hết hạn hôm nay" : `Còn ${days} ngày`;
}
export function formatDay(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
