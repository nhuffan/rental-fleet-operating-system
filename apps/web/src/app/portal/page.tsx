import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { PortalPagination } from "@/features/portal/portal-pagination";
import { PortalRentalsTable } from "@/features/portal/portal-tables";
import { portalApi, portalContext } from "@/features/portal/server";
import type { PortalRentalPage } from "@/features/portal/types";
import { pageNumber, type SearchParams } from "@/lib/query";

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await portalContext();
  const page = pageNumber((await searchParams).page);
  const rentals = await portalApi<PortalRentalPage>(
    `/portal/rentals?page=${page}&limit=20`,
  );
  return (
    <>
      <PageHeader
        title="Hợp đồng thuê của bạn"
        description={`Hợp đồng bạn đã đặt tại ${context.businessName}. Cổng này chỉ để xem và in; liên hệ doanh nghiệp để thay đổi.`}
      />
      <Panel>
        <PanelHeader
          title="Danh sách hợp đồng"
          subtitle={`${rentals.total} hợp đồng · Thời gian theo giờ Việt Nam`}
          icon="rental"
        />
        <PortalRentalsTable rentals={rentals.data} />
        <PortalPagination
          page={rentals.page}
          limit={rentals.limit}
          total={rentals.total}
        />
      </Panel>
    </>
  );
}
