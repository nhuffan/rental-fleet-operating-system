import Link from "next/link";
import { DataTable } from "@/components/data-display/table";
import { formatDate } from "@/lib/query";
import { formatMoney } from "./query";
import { RentalStatus } from "./rental-status";
import type { Rental } from "./types";
export function RentalTable({
  rentals,
  currency,
}: {
  rentals: Rental[];
  currency: string;
}) {
  return (
    <DataTable
      caption="Hợp đồng thuê trong doanh nghiệp"
      rows={rentals}
      columns={[
        {
          key: "rental",
          label: "Hợp đồng / xe",
          render: (rental) => (
            <Link
              href={`/app/rentals/${rental.id}`}
              className="fleet-record-link"
            >
              <strong>{rental.vehicle.licensePlate}</strong>
              <small className="fleet-cell-meta">
                #{rental.id.slice(0, 8)}
              </small>
            </Link>
          ),
        },
        {
          key: "customer",
          label: "Khách hàng",
          render: (rental) => (
            <Link href={`/app/customers/${rental.customerId}`}>
              {rental.customer.name}
            </Link>
          ),
        },
        {
          key: "dates",
          label: "Thời gian thuê (VN)",
          render: (rental) => (
            <span>
              {formatDate(rental.startAt)}
              <small className="fleet-cell-meta">
                → {formatDate(rental.endAt)}
              </small>
            </span>
          ),
        },
        {
          key: "status",
          label: "Trạng thái",
          render: (rental) => (
            <RentalStatus status={rental.status} overdue={rental.isOverdue} />
          ),
        },
        {
          key: "amount",
          label: "Tiền thuê",
          render: (rental) => formatMoney(rental.rentalAmount, currency),
        },
        {
          key: "detail",
          label: "Thao tác",
          render: (rental) => (
            <Link
              className="button button-secondary"
              href={`/app/rentals/${rental.id}`}
            >
              Chi tiết
            </Link>
          ),
        },
      ]}
    />
  );
}
