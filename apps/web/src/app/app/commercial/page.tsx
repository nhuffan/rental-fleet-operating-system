import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { CommercialPanel } from "@/features/commercial/commercial-panel";
import { commercialContext } from "@/features/commercial/server";
import { apiFilters, commercialFilters } from "@/features/commercial/query";
import type {
  CommercialSummary,
  MovementPage,
} from "@/features/commercial/types";
import { queryString, type SearchParams } from "@/lib/query";
export default async function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await commercialContext();
  const filters = commercialFilters(await searchParams),
    query = apiFilters(filters);
  const [initial, summary] = await Promise.all([
    api<MovementPage>(`/commercial/movements?${queryString(query)}`),
    api<CommercialSummary>(
      `/commercial/summary?${queryString({ from: query.from, until: query.until, vehicleId: query.vehicleId, rentalId: query.rentalId })}`,
    ),
  ]);
  return (
    <>
      <PageHeader
        title="Thương mại"
        description="Theo dõi khoản thu, chi phí vận hành và tiền cọc từ giao dịch thực tế của doanh nghiệp."
      />
      <CommercialPanel
        key={context.business.id}
        initial={initial}
        summary={summary}
        context={context}
        filters={filters}
      />
    </>
  );
}
