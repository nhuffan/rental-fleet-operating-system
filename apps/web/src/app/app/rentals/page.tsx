import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { RentalsPanel } from "@/features/rentals/rentals-panel";
import { rentalContext } from "@/features/rentals/server";
import { rentalFilters } from "@/features/rentals/query";
import { queryString, type SearchParams } from "@/features/vehicles/query";
import type { RentalPage } from "@/features/rentals/types";
export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await rentalContext("rental.read");
  const filters = rentalFilters(await searchParams);
  const initial = await api<RentalPage>(`/rentals?${queryString(filters)}`);
  return (
    <>
      <PageHeader
        title="Hợp đồng thuê"
        description="Đặt xe, bàn giao, gia hạn và nhận trả trên dữ liệu thật."
      />
      <RentalsPanel
        key={`${context.business.id}:${queryString(filters)}`}
        initial={initial}
        context={context}
        filters={filters}
      />
    </>
  );
}
