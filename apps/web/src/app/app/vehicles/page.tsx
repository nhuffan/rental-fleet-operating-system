import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { FleetTabs } from "@/features/vehicles/fleet-tabs";
import { VehiclesPanel } from "@/features/vehicles/vehicles-panel";
import { fleetContext, tenantBranches } from "@/features/vehicles/server";
import {
  queryString,
  vehicleFilters,
  type SearchParams,
} from "@/features/vehicles/query";
import type { VehiclePage } from "@/features/vehicles/types";
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await fleetContext();
  const filters = vehicleFilters(await searchParams);
  const [initial, branches] = await Promise.all([
    api<VehiclePage>(`/vehicles?${queryString(filters)}`),
    tenantBranches(),
  ]);
  return (
    <>
      <PageHeader
        title="Đội xe"
        description="Hồ sơ xe, chi nhánh và thiết bị đã gắn trong doanh nghiệp."
      />
      <FleetTabs active="vehicles" />
      <VehiclesPanel
        key={`${context.business.id}:${queryString(filters)}`}
        initial={initial}
        context={context}
        branches={branches}
        filters={filters}
      />
    </>
  );
}
