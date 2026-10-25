import { commercialFilters, apiFilters } from "../query";
import { tollStatuses } from "./policy";
import { text, type SearchParams } from "@/lib/query";
export function tollFilters(params: SearchParams) {
  const standard = commercialFilters(params);
  const status = text(params.status);
  return {
    page: standard.page,
    limit: standard.limit,
    vehicleId: standard.vehicleId,
    rentalId: standard.rentalId,
    from: standard.from,
    until: standard.until,
    status: tollStatuses.includes(status as (typeof tollStatuses)[number])
      ? status
      : "",
  };
}
export type TollFilters = ReturnType<typeof tollFilters>;
export function tollApiFilters(filters: TollFilters) {
  const query = apiFilters({ ...filters, search: "", kind: "", category: "" });
  return {
    page: query.page,
    limit: query.limit,
    vehicleId: query.vehicleId,
    rentalId: query.rentalId,
    status: filters.status,
    from: query.from,
    until: query.until,
  };
}
