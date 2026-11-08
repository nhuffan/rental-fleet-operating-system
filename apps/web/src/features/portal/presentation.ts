// Pure helpers (no path aliases) so the node test runner can import them directly.
export const portalStatusLabels: Record<string, string> = {
  RESERVED: "Đã đặt xe",
  ACTIVE: "Đang thuê",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
// Amounts arrive as exact database strings; never convert them through Number.
export function portalMoney(value: string, currency: string) {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return "Không khả dụng";
  const fraction = match[2]?.replace(/0+$/, "");
  if (currency !== "VND") return `${value} ${currency}`;
  const whole = new Intl.NumberFormat("vi-VN").format(BigInt(match[1]));
  return `${whole}${fraction ? `,${fraction}` : ""} ₫`;
}
export function portalVersion(value: string) {
  return /^[1-9][0-9]{0,9}$/.test(value) && Number(value) <= 2147483647
    ? Number(value)
    : null;
}
