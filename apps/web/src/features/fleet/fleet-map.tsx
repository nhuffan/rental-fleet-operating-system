"use client";
import { useState } from "react";
import { Button, EmptyState } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { SearchInput } from "@/components/data-display/table";
import { vehicles, rentals, formatDate, type Vehicle } from "./fixtures";
import { CarIllustration, GPSBadge, VehicleBadge } from "./fleet-visuals";
export function FleetMap({
  onVehicle,
  expanded = false,
}: {
  onVehicle: (v: Vehicle) => void;
  expanded?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<string | null>("v1");
  const [list, setList] = useState(false);
  const filtered = vehicles.filter(
    (v) =>
      `${v.plate} ${v.model}`.toLowerCase().includes(query.toLowerCase()) &&
      (status === "ALL" || v.gps === status),
  );
  const active = filtered.find((v) => v.id === selected);
  const rental =
    active &&
    rentals.find((r) => r.vehicleId === active.id && r.status === "ACTIVE");
  return (
    <div className={expanded ? "expanded-map" : ""}>
      <div className="map-toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Tìm xe trong doanh nghiệp minh họa…"
        />
        <select
          className="filter-select"
          aria-label="Lọc tín hiệu GPS"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">Tất cả GPS</option>
          <option value="ONLINE">Có tín hiệu*</option>
          <option value="STALE">Tín hiệu trễ</option>
          <option value="OFFLINE">Mất kết nối</option>
        </select>
        <Button
          variant="secondary"
          className="map-list-toggle"
          onClick={() => setList(!list)}
          aria-pressed={list}
        >
          {list ? "Bản đồ" : "Danh sách"}
        </Button>
      </div>
      <div className={`map-layout ${expanded ? "with-vehicle-list" : ""}`}>
        {(expanded || list) && (
          <div
            className="map-vehicle-list"
            aria-label="Danh sách xe trên bản đồ"
          >
            {filtered.map((v) => (
              <button
                key={v.id}
                className={`map-vehicle-row ${active?.id === v.id ? "selected" : ""}`}
                onClick={() => {
                  setSelected(v.id);
                  if (list) onVehicle(v);
                }}
              >
                <CarIllustration vehicle={v} />
                <strong>
                  {v.plate}
                  <small>{v.model}</small>
                </strong>
                <GPSBadge vehicle={v} />
              </button>
            ))}
            {!filtered.length && <EmptyState title="Không tìm thấy xe" />}
          </div>
        )}
        <div className={`fleet-map-canvas ${list ? "map-hidden" : ""}`}>
          <svg
            className="map-drawing"
            viewBox="0 0 900 500"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id={expanded ? "blocks-full" : "blocks-preview"}
                width="105"
                height="83"
                patternTransform="rotate(-18)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="105" height="83" fill="#eef0eb" />
                <rect
                  x="7"
                  y="7"
                  width="90"
                  height="68"
                  rx="5"
                  fill="#e5e9e1"
                />
                <path d="M0 0h105M0 0v83" stroke="white" strokeWidth="10" />
              </pattern>
            </defs>
            <rect
              width="900"
              height="500"
              fill={`url(#${expanded ? "blocks-full" : "blocks-preview"})`}
            />
            <path
              d="M640-20c-110 90 30 150-65 230S540 350 650 520"
              fill="none"
              stroke="#c3dce1"
              strokeWidth="72"
            />
            <path
              d="M-20 220 920 80M150-20 330 520M-20 430 920 310"
              stroke="#fff"
              strokeWidth="15"
              fill="none"
            />
            <path
              d="M-20 220 920 80M150-20 330 520M-20 430 920 310"
              stroke="#e6d4b3"
              strokeWidth="3"
              fill="none"
            />
            <path d="M100 80h100v70H100zM690 340h130v90H690z" fill="#cfddc8" />
            <g fill="#86948a" fontSize="13" fontFamily="Arial">
              <text x="330" y="230">
                KHU TRUNG TÂM
              </text>
              <text x="665" y="180">
                KHU ĐÔNG
              </text>
              <text x="140" y="380">
                KHU NAM
              </text>
            </g>
          </svg>
          <div className="map-demo-label">
            Sơ đồ minh họa · Không phải GPS trực tiếp
          </div>
          {filtered.map((v) => (
            <button
              key={v.id}
              className={`fleet-marker ${active?.id === v.id ? "selected" : ""} gps-${v.gps.toLowerCase()}`}
              style={{ left: `${v.x}%`, top: `${v.y}%` }}
              onClick={() => setSelected(v.id)}
              aria-label={`Xem xe ${v.plate} ${v.model}`}
              aria-pressed={active?.id === v.id}
            >
              <Icon name="car" size={17} />
            </button>
          ))}
          {!filtered.length && (
            <div className="map-empty">
              <EmptyState
                title="Không tìm thấy xe"
                description="Thử thay đổi từ khóa hoặc bộ lọc GPS."
              />
            </div>
          )}
          {active && (
            <div className="map-popover">
              <div className="map-popover-car">
                <CarIllustration vehicle={active} />
                <button
                  aria-label="Đóng xem trước xe"
                  className="popover-close"
                  onClick={() => setSelected(null)}
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
              <div className="map-popover-body">
                <div
                  className="inline"
                  style={{ justifyContent: "space-between" }}
                >
                  <strong>{active.plate}</strong>
                  <VehicleBadge vehicle={active} />
                </div>
                <p>{active.model}</p>
                <GPSBadge vehicle={active} />
                <small>
                  Vị trí cuối: {formatDate(active.lastSeen)} · UTC+7
                </small>
                {rental && (
                  <>
                    <small>{rental.customer}</small>
                    <small>Hẹn trả: {formatDate(rental.end)} · UTC+7</small>
                  </>
                )}
                <button
                  className="map-detail-link"
                  onClick={() => onVehicle(active)}
                >
                  Xem chi tiết xe <Icon name="arrow" size={13} />
                </button>
              </div>
            </div>
          )}
          <div className="map-scale">SƠ ĐỒ KHÔNG THEO TỶ LỆ</div>
        </div>
      </div>
      <div className="map-footnote">
        <span>
          <i className="legend-dot success-dot" />
          Có tín hiệu*
        </span>
        <span>
          <i className="legend-dot warning-dot" />
          Tín hiệu trễ
        </span>
        <span>
          <i className="legend-dot neutral-dot" />
          Mất kết nối
        </span>
        <small>*Tại mốc minh họa 22/10/2026, 10:00 UTC+7</small>
      </div>
    </div>
  );
}
