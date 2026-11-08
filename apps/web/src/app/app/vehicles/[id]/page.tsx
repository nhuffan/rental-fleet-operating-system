import { VehicleLocationPanel } from "@/features/telematics/gps/vehicle-location-panel";
import type { VehicleLocation } from "@/features/telematics/gps/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { VehicleDetail } from "@/features/fleet/vehicles/vehicle-detail";
import { fleetContext, tenantBranches } from "@/features/fleet/vehicles/server";
import { pageNumber, validId, type SearchParams } from "@/lib/query";
import type {
  VehicleLatestInspection,
  VehicleRentalState,
} from "@/features/rentals/types";
import type {
  DeviceAssignmentPage,
  ServiceRecordPage,
  Vehicle,
} from "@/features/fleet/vehicles/types";
export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await fleetContext();
  const { id } = await params;
  if (!validId(id)) notFound();
  const page = pageNumber((await searchParams).page);
  const [
    vehicle,
    history,
    serviceRecords,
    branches,
    location,
    rentalState,
    latestInspection,
  ] = await Promise.all([
      api<Vehicle>(`/vehicles/${id}`, { notFoundOn404: true }),
      api<DeviceAssignmentPage>(
        `/vehicles/${id}/device-assignments?page=${page}&limit=20`,
        { notFoundOn404: true },
      ),
      api<ServiceRecordPage>(`/vehicles/${id}/service-records?page=1&limit=20`, {
        notFoundOn404: true,
      }),
      tenantBranches(),
      context.permissions.includes("gps.read")
        ? api<VehicleLocation>(`/vehicles/${id}/location`, {
            notFoundOn404: true,
          })
        : Promise.resolve(null),
      context.permissions.includes("rental.read")
        ? api<VehicleRentalState>(`/vehicles/${id}/rental-state`, {
            notFoundOn404: true,
          })
        : Promise.resolve(null),
      context.permissions.includes("rental.read")
        ? api<VehicleLatestInspection>(`/vehicles/${id}/latest-inspection`, {
            notFoundOn404: true,
          })
        : Promise.resolve(null),
    ]);
  return (
    <>
      <Link href="/app/vehicles" className="back-link">
        ← Danh sách xe
      </Link>
      <PageHeader
        title={vehicle.licensePlate}
        description={`${vehicle.make} ${vehicle.model}`}
      />
      {location && <VehicleLocationPanel data={location} />}
      <VehicleDetail
        key={`${context.business.id}:${vehicle.id}`}
        vehicle={vehicle}
        history={history}
        serviceRecords={serviceRecords}
        branches={branches}
        context={context}
        rentalState={rentalState}
        latestInspection={latestInspection}
      />
    </>
  );
}
