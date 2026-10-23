import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiResponseError } from "@/lib/api";
import { pageNumber, type SearchParams } from "@/lib/query";
import { PageHeader } from "@/components/ui/primitives";
import { tripContext } from "@/features/telematics/trips/server";
import { TripDetail } from "@/features/telematics/trips/trip-detail";
import type { Trip, TripRoute } from "@/features/telematics/trips/types";
export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await tripContext();
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{20,600}$/.test(id)) notFound();
  const page = pageNumber((await searchParams).routePage);
  const path = `/trips/${encodeURIComponent(id)}`;
  let trip: Trip;
  let route: TripRoute;
  try {
    [trip, route] = await Promise.all([
      api<Trip>(path, { notFoundOn404: true }),
      api<TripRoute>(`${path}/route?page=${page}&limit=500`, {
        notFoundOn404: true,
      }),
    ]);
  } catch (cause) {
    if (
      cause instanceof ApiResponseError &&
      cause.status === 400 &&
      cause.code === "INVALID_TRIP_ID"
    )
      notFound();
    throw cause;
  }
  return (
    <>
      <Link className="back-link" href="/app/trips">
        ← Danh sách hành trình
      </Link>
      <PageHeader
        title={`Hành trình · ${trip.licensePlate}`}
        description="Xem lại lịch sử GPS TEST theo thời gian ghi nhận. Các điểm được giới hạn và phân trang; lịch sử không tự tải lại liên tục."
      />
      <TripDetail
        key={`${context.business.id}:${trip.id}:${page}`}
        trip={trip}
        route={route}
        canReadRental={context.permissions.includes("rental.read")}
      />
    </>
  );
}
