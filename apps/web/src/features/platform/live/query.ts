import { pageNumber, text, type SearchParams } from "@/lib/query";
export function businessFilters(params: SearchParams) {
  const status = text(params.status);
  return {
    page: pageNumber(params.page),
    limit: [20, 50, 100].includes(Number(params.limit))
      ? Number(params.limit)
      : 20,
    search: text(params.search, 120),
    status: ["ACTIVE", "DISABLED"].includes(status) ? status : "",
    sort: text(params.sort) === "name" ? "name" : "createdAt",
    order: text(params.order) === "asc" ? "asc" : "desc",
  };
}
export type BusinessFilters = ReturnType<typeof businessFilters>;
