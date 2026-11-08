"use client";
import Link from "next/link";
import { DataTable } from "@/components/data-display/table";
import { RentalStatus } from "@/features/rentals/rental-status";
import { formatDate } from "@/lib/query";
import { portalMoney } from "./presentation";
import type { PortalRental, PortalRentalDetail } from "./types";

// DataTable column renderers are functions, so tables live in client components.
export function PortalRentalsTable({ rentals }: { rentals: PortalRental[] }) {
  return (
    <DataTable
      caption="Hợp đồng thuê của bạn"
      rows={rentals}
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
  );
}

export function PortalContractsTable({
  rentalId,
  contracts,
}: {
  rentalId: string;
  contracts: PortalRentalDetail["contracts"];
}) {
  return (
    <DataTable
      caption="Các phiên bản hợp đồng"
      rows={contracts.map((c) => ({ ...c, id: String(c.version) }))}
      emptyState={{
        title: "Chưa phát hành hợp đồng",
        description: "Doanh nghiệp sẽ phát hành hợp đồng sau khi xác nhận.",
      }}
      columns={[
        { key: "number", label: "Số hợp đồng", render: (c) => c.docNumber },
        { key: "version", label: "Phiên bản", render: (c) => `v${c.version}` },
        {
          key: "issued",
          label: "Phát hành (VN)",
          render: (c) => formatDate(c.issuedAt),
        },
        {
          key: "open",
          label: "Xem / in",
          render: (c) => (
            <Link
              className="fleet-record-link"
              href={`/portal/rentals/${rentalId}/contract/${c.version}`}
            >
              Mở bản in
            </Link>
          ),
        },
      ]}
    />
  );
}
