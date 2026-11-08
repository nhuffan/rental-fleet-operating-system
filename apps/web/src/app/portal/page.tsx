import Link from "next/link";
import { DataTable } from "@/components/data-display/table";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { PortalPagination } from "@/features/portal/portal-pagination";
import { RentalStatus } from "@/features/rentals/rental-status";
import { portalApi, portalContext } from "@/features/portal/server";
import { portalMoney } from "@/features/portal/presentation";
import type { PortalRentalPage } from "@/features/portal/types";
import { formatDate, pageNumber, type SearchParams } from "@/lib/query";

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
        <DataTable
          caption="Hợp đồng thuê của bạn"
          rows={rentals.data}
          emptyState={{
            title: "Chưa có hợp đồng",
            description: "Hợp đồng sẽ xuất hiện sau khi doanh nghiệp xác nhận đặt xe.",
          }}
          columns={[
            {
              key: "vehicle",
              label: "Xe",
              render: (r) => (
                <Link className="fleet-record-link" href={`/portal/rentals/${r.id}`}>
                  {r.licensePlate} · {r.make} {r.model}
                </Link>
              ),
            },
            {
              key: "time",
              label: "Thời gian thuê",
              render: (r) => `${formatDate(r.startAt)} → ${formatDate(r.endAt)}`,
            },
            {
              key: "amount",
              label: "Tiền thuê",
              render: (r) => portalMoney(r.rentalAmount, r.currency),
            },
            {
              key: "status",
              label: "Trạng thái",
              render: (r) => <RentalStatus status={r.status} />,
            },
          ]}
        />
        <PortalPagination
          page={rentals.page}
          limit={rentals.limit}
          total={rentals.total}
        />
      </Panel>
    </>
  );
}
