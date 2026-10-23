"use client";
import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import {
  rentals,
  vehicles,
  fixtureNow,
  isOverdue,
  formatDate,
  type Rental,
} from "./fixtures";
export function FleetSchedule({ onRental }: { onRental: (r: Rental) => void }) {
  const [mode, setMode] = useState<"day" | "week">("week");
  const start = new Date(
    mode === "week" ? "2026-10-20T00:00:00+07:00" : "2026-10-22T00:00:00+07:00",
  ).getTime();
  const duration = (mode === "week" ? 7 : 1) * 86400000;
  const now = ((fixtureNow.getTime() - start) / duration) * 100;
  const headers =
    mode === "week"
      ? [
          "T3 · 20",
          "T4 · 21",
          "T5 · 22",
          "T6 · 23",
          "T7 · 24",
          "CN · 25",
          "T2 · 26",
        ]
      : ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
  return (
    <Panel className="schedule-panel">
      <PanelHeader
        title="Lịch đội xe"
        subtitle={
          mode === "week"
            ? "20–26 tháng 10, 2026 · UTC+7"
            : "22 tháng 10, 2026 · UTC+7"
        }
        icon="calendar"
        action={
          <div className="segmented" aria-label="Chế độ lịch">
            <button
              aria-pressed={mode === "day"}
              onClick={() => setMode("day")}
            >
              Ngày
            </button>
            <button
              aria-pressed={mode === "week"}
              onClick={() => setMode("week")}
            >
              Tuần
            </button>
          </div>
        }
      />
      <div className="schedule-scroll">
        <div className="schedule">
          <div className="schedule-header">
            <span>Phương tiện</span>
            <div
              className="schedule-axis"
              style={{ gridTemplateColumns: `repeat(${headers.length},1fr)` }}
            >
              {headers.map((d, i) => (
                <span
                  className={mode === "week" && i === 2 ? "today-label" : ""}
                  key={d}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="schedule-body">
            {vehicles.slice(0, 6).map((v) => (
              <div className="schedule-row" key={v.id}>
                <div className="schedule-vehicle">
                  <strong>{v.plate}</strong>
                  <small>{v.model}</small>
                </div>
                <div
                  className="schedule-track"
                  style={{ backgroundSize: `${100 / headers.length}% 100%` }}
                >
                  <span className="today-line" style={{ left: `${now}%` }} />
                  {rentals
                    .filter(
                      (r) =>
                        r.vehicleId === v.id &&
                        new Date(r.start).getTime() < start + duration &&
                        new Date(r.end).getTime() > start,
                    )
                    .map((r) => {
                      const left = Math.max(
                        0,
                        ((new Date(r.start).getTime() - start) / duration) *
                          100,
                      );
                      const right = Math.min(
                        100,
                        ((new Date(r.end).getTime() - start) / duration) * 100,
                      );
                      return (
                        <button
                          key={r.id}
                          className={`booking booking-${isOverdue(r) ? "overdue" : r.status.toLowerCase()}`}
                          style={{
                            left: `${left}%`,
                            width: `${right - left}%`,
                          }}
                          title={`${r.id} · ${formatDate(r.start)} → ${formatDate(r.end)} UTC+7`}
                          onClick={() => onRental(r)}
                          aria-label={`Mở ${r.id}, ${v.plate}, ${formatDate(r.start)} đến ${formatDate(r.end)} UTC+7`}
                        >
                          <span>{r.customer}</span>
                          <small>{r.id}</small>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="schedule-legend">
        <span>
          <i className="legend-dot brand-dot" />
          Đã đặt
        </span>
        <span>
          <i className="legend-dot success-dot" />
          Đang thuê
        </span>
        <span>
          <i className="legend-dot danger-dot" />
          Quá hạn
        </span>
        <span className="quiet">Vạch cam: mốc minh họa</span>
      </div>
    </Panel>
  );
}
