import { pageNumber, validId, text, type SearchParams } from "@/lib/query";
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
