import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { formatDate } from "@/features/vehicles/query";
import { RentalStatus } from "./rental-status";
import type { VehicleRentalState } from "./types";
export function VehicleRentalPanel({
  rentalState,
}: {
  rentalState: VehicleRentalState;
}) {
  return (
    <Panel className="rental-section">
      <PanelHeader
        title="Tình trạng thuê xe"
        subtitle="Tính từ vòng đời xe và các hợp đồng đang giữ lịch"
        icon="rental"
        action={<RentalStatus status={rentalState.state} />}
      />
      <div className="rental-current-grid">
        {(
          [
            ["Hợp đồng hiện tại", rentalState.currentRental],
            ["Lịch đặt tiếp theo", rentalState.nextRental],
          ] as const
        ).map(([label, rental]) => (
          <div key={label}>
            <h3>{label}</h3>
            {rental ? (
              <>
                <Link
                  className="fleet-record-link"
                  href={`/app/rentals/${rental.id}`}
                >
                  <strong>
                    {rental.customer.name} · #{rental.id.slice(0, 8)}
                  </strong>
                </Link>
                <p>
                  {formatDate(rental.startAt)} → {formatDate(rental.endAt)}
                </p>
                <RentalStatus
                  status={rental.status}
                  overdue={rental.isOverdue}
                />
              </>
            ) : (
              <p className="quiet">Chưa có hợp đồng phù hợp.</p>
            )}
          </div>
        ))}
      </div>
      <p className="quiet fleet-device-note">
        Tình trạng thuê là dữ liệu suy ra, tách biệt với trạng thái vòng đời xe
        và thiết bị GPS.
      </p>
    </Panel>
  );
}
