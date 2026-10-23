import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { CustomersPanel } from "@/features/rentals/customers-panel";
import { rentalContext } from "@/features/rentals/server";
import { customerFilters } from "@/features/rentals/query";
import { queryString, type SearchParams } from "@/lib/query";
import type { CustomerPage } from "@/features/rentals/types";
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await rentalContext("customer.read");
  const filters = customerFilters(await searchParams);
  const initial = await api<CustomerPage>(`/customers?${queryString(filters)}`);
  return (
    <>
      <PageHeader
        title="Khách hàng"
        description="Thông tin liên hệ và lịch sử hợp đồng theo doanh nghiệp."
      />
      <CustomersPanel
        key={context.business.id}
        initial={initial}
        context={context}
        filters={filters}
      />
    </>
  );
}
