import { deviceFilters } from "@/features/fleet/vehicles/query";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { FleetTabs } from "@/features/fleet/vehicles/fleet-tabs";
import { DevicesPanel } from "@/features/fleet/vehicles/devices-panel";
import { fleetContext } from "@/features/fleet/vehicles/server";
import { queryString, type SearchParams } from "@/lib/query";
import type { GpsDevicePage } from "@/features/fleet/vehicles/types";
export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await fleetContext();
  if (!context.permissions.includes("gps.read")) redirect("/access-denied");
  const filters = deviceFilters(await searchParams);
  const initial = await api<GpsDevicePage>(
    `/gps-devices?${queryString(filters)}`,
  );
  return (
    <>
      <PageHeader
        title="Thiết bị GPS"
        description="Đăng ký thiết bị và quản lý vòng đời. Theo dõi tín hiệu theo lần gắn tại Bản đồ đội xe."
      />
      <FleetTabs active="devices" />
      <DevicesPanel
        key={context.business.id}
        initial={initial}
        context={context}
        filters={filters}
      />
    </>
  );
}
