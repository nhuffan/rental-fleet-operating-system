import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { RentalDetail } from "@/features/rentals/rental-detail";
import { rentalContext } from "@/features/rentals/server";
import { validId, type SearchParams } from "@/features/vehicles/query";
import type { Rental } from "@/features/rentals/types";
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
  const rental = await api<Rental>(`/rentals/${id}`, { notFoundOn404: true });
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
        context={context}
        initialMessage={message}
      />
    </>
  );
}
