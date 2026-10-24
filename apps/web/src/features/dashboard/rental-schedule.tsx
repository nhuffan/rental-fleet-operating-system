"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Tabs } from "@/components/ui/primitives";
import { formatDate } from "@/lib/query";
import type { Rental } from "@/features/rentals/types";
import { intervalPosition, scheduleWindow } from "./schedule";

const dayLabel = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});
export function RentalSchedule({
  rentals,
  asOf,
}: {
  rentals: Rental[];
  asOf: string;
}) {
  const [mode, setMode] = useState<"day" | "week">("week");
  const [offset, setOffset] = useState(0);
  const anchor = new Date(rentals[0]?.startAt ?? asOf).getTime();
  const window = scheduleWindow(anchor, mode, offset);
  const count = mode === "week" ? 7 : 6;
  return (
    <>
      <div className="owner-schedule-toolbar">
        <div>
          <strong>{dayLabel.format(window.start)}</strong>
          {mode === "week" && <span> – {dayLabel.format(window.end - 1)}</span>}
          <small>Giờ Việt Nam · Theo hợp đồng trong trang này</small>
        </div>
        <Tabs
          value={mode}
          items={[
            { value: "day", label: "Ngày" },
            { value: "week", label: "7 ngày" },
          ]}
          onChange={(value) => {
            setMode(value as "day" | "week");
            setOffset(0);
          }}
        />
      </div>
      <div className="owner-schedule-window-nav">
        <Button
          variant="ghost"
          size="small"
          aria-label="Xem khoảng thời gian trước"
          onClick={() => setOffset((value) => value - 1)}
        >
          ← Trước
        </Button>
        <Button
          variant="ghost"
          size="small"
          disabled={offset === 0}
          onClick={() => setOffset(0)}
        >
          Về lịch đầu trang
        </Button>
        <Button
          variant="ghost"
          size="small"
          aria-label="Xem khoảng thời gian sau"
          onClick={() => setOffset((value) => value + 1)}
        >
          Sau →
        </Button>
      </div>
      <div className="owner-schedule-scroll">
        <div className="owner-schedule-grid">
          <div className="owner-schedule-header">
            <span>Xe / Khách thuê</span>
            <div style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
              {Array.from({ length: count }, (_, index) => (
                <span key={index}>
                  {mode === "week"
                    ? dayLabel.format(window.start + index * 86400000)
                    : `${String(index * 4).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>
          </div>
          {rentals.map((rental) => {
            const position = intervalPosition(
              rental.startAt,
              rental.endAt,
              window,
            );
            const href = `/app/rentals/${rental.id}`;
            return (
              <div className="owner-schedule-row" key={rental.id}>
                <Link className="owner-schedule-vehicle" href={href}>
                  <strong>{rental.vehicle.licensePlate}</strong>
                  <small>{rental.customer.name}</small>
                </Link>
                <div
                  className="owner-schedule-track"
                  style={{ backgroundSize: `${100 / count}% 100%` }}
                >
                  {position ? (
                    <Link
                      className="owner-schedule-booking"
                      href={href}
                      style={{
                        left: `${position.left}%`,
                        width: `${position.width}%`,
                      }}
                      title={`${rental.vehicle.licensePlate} · ${formatDate(rental.startAt)} → ${formatDate(rental.endAt)} · giờ Việt Nam`}
                      aria-label={`Hợp đồng ${rental.id.slice(0, 8)}, ${rental.vehicle.licensePlate}, ${formatDate(rental.startAt)} đến ${formatDate(rental.endAt)}, giờ Việt Nam`}
                    >
                      <strong>{rental.customer.name}</strong>
                      <small>
                        {formatDate(rental.startAt)} →{" "}
                        {formatDate(rental.endAt)}
                      </small>
                    </Link>
                  ) : (
                    <Link href={href} className="owner-schedule-outside">
                      Ngoài khung lịch · {formatDate(rental.startAt)} →{" "}
                      {formatDate(rental.endAt)}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="owner-schedule-note">
        <span className="owner-schedule-key" /> Thời gian thuê đã đặt. Chỉ hiển
        thị các hợp đồng của trang hiện tại; khoảng trống không xác nhận xe sẵn
        sàng.
      </p>
    </>
  );
}
