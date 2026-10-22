import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { FleetTabs } from "@/features/vehicles/fleet-tabs";
import { DevicesPanel } from "@/features/vehicles/devices-panel";
import { fleetContext } from "@/features/vehicles/server";
import {
  deviceFilters,
  queryString,
  type SearchParams,
} from "@/features/vehicles/query";
import type { GpsDevicePage } from "@/features/vehicles/types";
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
        description="Đăng ký thiết bị và quản lý trạng thái vòng đời. Chưa có dữ liệu vị trí hoặc kết nối trực tuyến."
      />
      <FleetTabs active="devices" />
      <DevicesPanel
        key={`${context.business.id}:${queryString(filters)}`}
        initial={initial}
        context={context}
        filters={filters}
      />
    </>
  );
}
