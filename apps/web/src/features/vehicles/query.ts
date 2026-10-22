export type SearchParams = Record<string, string | string[] | undefined>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validId(value: string) {
  return uuid.test(value);
}
function text(value: string | string[] | undefined, max = 100) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export function pageNumber(value: string | string[] | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 1000000 ? n : 1;
}
function common(params: SearchParams) {
  const status = text(params.status);
  const requestedLimit = Number(params.limit);
  return {
    page: pageNumber(params.page),
    limit: [20, 50, 100].includes(requestedLimit) ? requestedLimit : 20,
    search: text(params.search),
    status: status === "ACTIVE" || status === "INACTIVE" ? status : "",
    order: text(params.order) === "asc" ? "asc" : "desc",
  };
}
export function vehicleFilters(params: SearchParams) {
  const sort = text(params.sort);
  const branchId = text(params.branchId);
  return {
    ...common(params),
    branchId: validId(branchId) ? branchId : "",
    sort: ["createdAt", "licensePlate", "make", "model"].includes(sort)
      ? sort
      : "createdAt",
  };
}
export function deviceFilters(params: SearchParams) {
  const sort = text(params.sort);
  const provider = text(params.provider, 40).toLowerCase();
  return {
    ...common(params),
    provider: /^[a-z0-9][a-z0-9_-]{0,39}$/.test(provider) ? provider : "",
    sort: ["createdAt", "provider", "deviceUid"].includes(sort)
      ? sort
      : "createdAt",
  };
}
export type VehicleFilters = ReturnType<typeof vehicleFilters>;
export type DeviceFilters = ReturnType<typeof deviceFilters>;
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
