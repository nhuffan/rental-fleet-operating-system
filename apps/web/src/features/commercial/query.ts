import { pageNumber, text, validId, type SearchParams } from "@/lib/query";
export const kinds = [
  "RENTAL_PAYMENT",
  "MISC_INCOME",
  "DEPOSIT_RECEIPT",
  "DEPOSIT_REFUND",
  "DEPOSIT_RETAIN",
  "EXPENSE",
] as const;
export const kindLabels = {
  RENTAL_PAYMENT: "Thu tiền thuê",
  MISC_INCOME: "Thu khác",
  DEPOSIT_RECEIPT: "Nhận cọc",
  DEPOSIT_REFUND: "Hoàn cọc",
  DEPOSIT_RETAIN: "Giữ lại cọc",
  EXPENSE: "Chi phí vận hành",
};
export const categoryLabels = {
  RENTAL: "Tiền thuê",
  OTHER_INCOME: "Thu khác",
  DEPOSIT: "Tiền cọc",
  FUEL: "Nhiên liệu",
  MAINTENANCE: "Bảo dưỡng",
  TOLL: "Phí đường bộ (thủ công)",
  INSURANCE: "Bảo hiểm",
  OTHER_EXPENSE: "Chi phí khác",
};
export const statusLabels = {
  POSTED: "Đã ghi nhận",
  REVERSED: "Đã đảo",
  REVERSAL: "Bút toán đảo",
};
function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isFinite(date.getTime()) &&
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date) === value
    ? value
    : "";
}
export function commercialFilters(params: SearchParams) {
  const kind = text(params.kind),
    category = text(params.category),
    status = text(params.status);
  return {
    page: pageNumber(params.page),
    limit: [20, 50, 100].includes(Number(params.limit))
      ? Number(params.limit)
      : 20,
    search: text(params.search),
    kind: kinds.includes(kind as (typeof kinds)[number]) ? kind : "",
    category: Object.hasOwn(categoryLabels, category) ? category : "",
    status: Object.hasOwn(statusLabels, status) ? status : "",
    from: day(text(params.from)),
    until: day(text(params.until)),
    vehicleId: validId(text(params.vehicleId)) ? text(params.vehicleId) : "",
    rentalId: validId(text(params.rentalId)) ? text(params.rentalId) : "",
  };
}
export type CommercialFilters = ReturnType<typeof commercialFilters>;
export function apiFilters(filters: CommercialFilters) {
  return {
    ...filters,
    from: filters.from
      ? new Date(`${filters.from}T00:00:00+07:00`).toISOString()
      : "",
    until: filters.until
      ? new Date(
          new Date(`${filters.until}T00:00:00+07:00`).getTime() + 86400000,
        ).toISOString()
      : "",
  };
}
// API returns exact VND strings. Preserve both integers and legacy rental decimals without Number conversion.
export function commercialMoney(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return "Không khả dụng";
  const whole = new Intl.NumberFormat("vi-VN").format(BigInt(match[2]));
  const fraction = match[3]?.replace(/0+$/, "");
  return `${match[1]}${whole}${fraction ? `,${fraction}` : ""} ₫`;
}
