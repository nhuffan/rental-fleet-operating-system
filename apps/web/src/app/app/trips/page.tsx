import { api, ApiResponseError } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { queryString, type SearchParams } from "@/lib/query";
import { tripContext } from "@/features/telematics/trips/server";
import { tripFilters } from "@/features/telematics/trips/query";
import { TripsPanel } from "@/features/telematics/trips/trips-panel";
import type { TripPage } from "@/features/telematics/trips/types";
import type { Vehicle } from "@/features/fleet/vehicles/types";
import type { Rental } from "@/features/rentals/types";
export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await tripContext();
  const { filters, error } = tripFilters(await searchParams);
  let initial: TripPage | null = null;
  let filterError = error;
  if (!filterError) {
    try {
      initial = await api<TripPage>(`/trips?${queryString(filters)}`, {
        notFoundOn404: true,
      });
    } catch (cause) {
      if (
        cause instanceof ApiResponseError &&
        cause.status === 422 &&
        cause.code === "TRIP_POINT_LIMIT"
      )
        filterError =
          "Khoảng tra cứu có quá nhiều điểm GPS (tối đa 10.000 điểm). Hãy chọn một xe hoặc thu hẹp thời gian rồi áp dụng lại bộ lọc.";
      else throw cause;
    }
  }
  const [vehicle, rental] = error
    ? [null, null]
    : await Promise.all([
        filters.vehicleId && context.permissions.includes("vehicle.read")
          ? api<Vehicle>(`/vehicles/${filters.vehicleId}`, {
              notFoundOn404: true,
            })
          : Promise.resolve(null),
        filters.rentalId && context.permissions.includes("rental.read")
          ? api<Rental>(`/rentals/${filters.rentalId}`, { notFoundOn404: true })
          : Promise.resolve(null),
      ]);
  return (
    <>
      <PageHeader
        eyebrow="LỊCH SỬ GPS"
        title="Hành trình"
        description="Tra cứu và xem lại các điểm GPS đã nhận. Hành trình được suy ra từ Traccar TEST feed, khoảng cách là ước tính."
      />
      <TripsPanel
        key={`${context.business.id}:${queryString(filters)}`}
        initial={initial}
        filters={filters}
        context={context}
        filterError={filterError}
        vehicleLabel={vehicle?.licensePlate}
        rentalLabel={
          rental
            ? `#${rental.id.slice(0, 8)} · ${rental.vehicle.licensePlate}`
            : ""
        }
      />
    </>
  );
}
