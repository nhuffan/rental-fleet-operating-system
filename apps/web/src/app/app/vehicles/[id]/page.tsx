import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { VehicleDetail } from "@/features/vehicles/vehicle-detail";
import { fleetContext, tenantBranches } from "@/features/vehicles/server";
import {
  pageNumber,
  validId,
  type SearchParams,
} from "@/features/vehicles/query";
import type { DeviceAssignmentPage, Vehicle } from "@/features/vehicles/types";
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
  const [vehicle, history, branches] = await Promise.all([
    api<Vehicle>(`/vehicles/${id}`, { notFoundOn404: true }),
    api<DeviceAssignmentPage>(
      `/vehicles/${id}/device-assignments?page=${page}&limit=20`,
      { notFoundOn404: true },
    ),
    tenantBranches(),
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
      <VehicleDetail
        key={`${context.business.id}:${vehicle.id}`}
        vehicle={vehicle}
        history={history}
        branches={branches}
        context={context}
      />
    </>
  );
}
