"use client";
import { useState } from "react";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import {
  rentals,
  vehicleFor,
  isOverdue,
  isDueSoon,
  formatDate,
  type Rental,
} from "./fixtures";
import { RentalBadge, CarIllustration } from "./fleet-visuals";
export function ActiveRentalQueue({
  onRental,
}: {
  onRental: (r: Rental) => void;
}) {
  const [tab, setTab] = useState("ongoing");
  const rows = rentals.filter((r) =>
    tab === "overdue"
      ? isOverdue(r)
      : tab === "due"
        ? isDueSoon(r)
        : r.status === "ACTIVE",
  );
  return (
    <Panel className="queue-panel">
      <PanelHeader
        title="Hợp đồng đang diễn ra"
        subtitle="Ưu tiên những việc cần xử lý"
        icon="rental"
      />
      <div className="queue-tabs" aria-label="Lọc hàng đợi hợp đồng">
        {[
          ["ongoing", "Đang thuê"],
          ["due", "Sắp trả"],
          ["overdue", "Quá hạn"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="rental-queue">
        {rows.map((r) => {
          const v = vehicleFor(r.vehicleId);
          return (
            <button
              key={r.id}
              className="queue-card"
              onClick={() => onRental(r)}
            >
              <div className="queue-card-top">
                <span>{r.id}</span>
                <RentalBadge rental={r} />
              </div>
              <div className="queue-car-row">
                <CarIllustration vehicle={v} />
                <div>
                  <strong>{v.model}</strong>
                  <small>
                    {v.plate} · {r.customer}
                  </small>
                </div>
                <Icon name="chevron" size={16} />
              </div>
              <div className={`queue-due ${isOverdue(r) ? "is-overdue" : ""}`}>
                <Icon name="clock" size={12} />
                {isOverdue(r) ? "Đã quá hạn" : "Hẹn trả"}: {formatDate(r.end)} ·
                UTC+7
              </div>
            </button>
          );
        })}
        {!rows.length && (
          <EmptyState
            title="Không có hợp đồng"
            description="Không có hợp đồng minh họa trong nhóm này."
            icon="rental"
          />
        )}
      </div>
    </Panel>
  );
}
