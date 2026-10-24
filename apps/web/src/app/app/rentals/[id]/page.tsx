import { rentalTripRange } from "@/features/telematics/trips/query";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiResponseError } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { RentalDetail } from "@/features/rentals/rental-detail";
import { rentalContext } from "@/features/rentals/server";
import { validId, type SearchParams } from "@/lib/query";
import type { RentalCommercial } from "@/features/commercial/types";
import type { Rental, RentalInspections } from "@/features/rentals/types";
export default async function RentalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await rentalContext("rental.read");
  const { id } = await params;
  if (!validId(id)) notFound();
  const [rental, inspections] = await Promise.all([
    api<Rental>(`/rentals/${id}`, { notFoundOn404: true }),
    api<RentalInspections>(`/rentals/${id}/inspections`, {
      notFoundOn404: true,
    }),
  ]);
  let commercial: RentalCommercial | null = null;
  let commercialIssue: "currency" | "unavailable" | undefined;
  if (context.permissions.includes("commercial.read")) {
    if (context.business.currency !== "VND") {
      commercialIssue = "currency";
    } else {
      try {
        commercial = await api<RentalCommercial>(`/rentals/${id}/commercial`);
      } catch (error) {
        if (
          error instanceof ApiResponseError &&
          (error.status === 409 || error.status >= 500)
        ) {
          commercialIssue = "unavailable";
        } else {
          throw error;
        }
      }
    }
  }
  const tripRange = rentalTripRange(rental.startAt, rental.endAt);
  const saved = (await searchParams).saved;
  const message =
    saved === "reserved"
      ? "Đã tạo hợp đồng và xác nhận đặt xe."
      : saved === "draft"
        ? "Đã lưu bản nháp hợp đồng."
        : "";
  return (
    <>
      <Link className="back-link" href="/app/rentals">
        ← Danh sách hợp đồng
      </Link>
      <PageHeader
        title={`Hợp đồng #${rental.id.slice(0, 8)}`}
        description={`${rental.vehicle.licensePlate} · ${rental.customer.name}`}
      />
      <RentalDetail
        key={`${context.business.id}:${id}`}
        rental={rental}
        inspections={inspections.data}
        commercial={commercial}
        commercialIssue={commercialIssue}
        tripRange={tripRange}
        context={context}
        initialMessage={message}
      />
    </>
  );
}
