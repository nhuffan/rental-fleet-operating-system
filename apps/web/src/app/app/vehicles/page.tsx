import { vehicleFilters } from "@/features/fleet/vehicles/query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { FleetTabs } from "@/features/fleet/vehicles/fleet-tabs";
import { VehiclesPanel } from "@/features/fleet/vehicles/vehicles-panel";
import { fleetContext, tenantBranches } from "@/features/fleet/vehicles/server";
import { queryString, type SearchParams } from "@/lib/query";
import type { VehiclePage } from "@/features/fleet/vehicles/types";
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
        key={context.business.id}
        initial={initial}
        context={context}
        branches={branches}
        filters={filters}
      />
    </>
  );
}
