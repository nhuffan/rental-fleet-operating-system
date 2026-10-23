import "server-only";
import type { Branch, Page } from "@rental-fleet/contracts";
import { redirect } from "next/navigation";
import { api, currentContext } from "@/lib/api";

export async function fleetContext() {
  const context = await currentContext();
  if (!context.permissions.includes("vehicle.read")) redirect("/access-denied");
  return context;
}
// The branch API is paginated. Fetch every page so a valid tenant branch is
// never silently omitted from the vehicle editor or list filter.
export async function tenantBranches() {
  const first = await api<Page<Branch>>("/branches?page=1&limit=100");
  const data = [...first.data];
  for (let page = 2; (page - 1) * first.limit < first.total; page++) {
    const next = await api<Page<Branch>>(`/branches?page=${page}&limit=100`);
    data.push(...next.data);
  }
  return data;
}
