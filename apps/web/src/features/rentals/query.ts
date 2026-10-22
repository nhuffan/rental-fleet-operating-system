import {
  pageNumber,
  validId,
  type SearchParams,
} from "@/features/vehicles/query";
export const rentalStatuses = [
  "DRAFT",
  "RESERVED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;
function text(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}
function common(params: SearchParams) {
  return {
    page: pageNumber(params.page),
    limit: [20, 50, 100].includes(Number(params.limit))
      ? Number(params.limit)
      : 20,
    search: text(params.search),
    order: text(params.order) === "asc" ? "asc" : "desc",
  };
}
export function customerFilters(params: SearchParams) {
  const status = text(params.status);
  return {
    ...common(params),
    status: ["ACTIVE", "INACTIVE"].includes(status) ? status : "",
    sort: text(params.sort) === "name" ? "name" : "createdAt",
  };
}
export function rentalFilters(params: SearchParams) {
  const status = text(params.status);
  const customerId = text(params.customerId);
  const vehicleId = text(params.vehicleId);
  return {
    ...common(params),
    status: rentalStatuses.includes(status as (typeof rentalStatuses)[number])
      ? status
      : "",
    overdue: text(params.overdue) === "true" ? "true" : "",
    customerId: validId(customerId) ? customerId : "",
    vehicleId: validId(vehicleId) ? vehicleId : "",
    sort: ["startAt", "endAt"].includes(text(params.sort))
      ? text(params.sort)
      : "createdAt",
  };
}
export type CustomerFilters = ReturnType<typeof customerFilters>;
export type RentalFilters = ReturnType<typeof rentalFilters>;
export function formatMoney(amount: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
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
