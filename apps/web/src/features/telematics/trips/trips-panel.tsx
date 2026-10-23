"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { DataTable, Pagination } from "@/components/data-display/table";
import { RecordPicker } from "@/components/data-display/record-picker";
import { Drawer } from "@/components/ui/drawer";
import { formatDate, queryString } from "@/lib/query";
import { localDateTime, utcDateTime } from "@/lib/date-time";
import type { Vehicle } from "@/features/fleet/vehicles/types";
import type { Rental } from "@/features/rentals/types";
import { distanceLabel, durationLabel, type TripFilters } from "./query";
import type { TripPage } from "./types";
const freshnessLabels = {
  FRESH: "Bản tin mới",
  STALE: "Bản tin trễ",
  OFFLINE: "Bản tin cũ",
};
function localInput(iso: string) {
  return Number.isFinite(Date.parse(iso)) ? localDateTime(iso) : "";
}
export function TripsPanel({
  initial,
  filters,
  context,
  filterError,
  vehicleLabel = "",
  rentalLabel = "",
}: {
  initial: TripPage | null;
  filters: TripFilters;
  context: Me;
  filterError: string;
  vehicleLabel?: string;
  rentalLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<"vehicle" | "rental" | null>(null);
  const [vehicle, setVehicle] = useState({
    id: filters.vehicleId,
    label: vehicleLabel || filters.vehicleId,
  });
  const [rental, setRental] = useState({
    id: filters.rentalId,
    label: rentalLabel || filters.rentalId,
  });
  function navigate(values: Record<string, string | number>) {
    setError("");
    startTransition(() => router.push(`/app/trips?${queryString(values)}`));
  }
  return (
    <>
      <Panel className="trip-panel">
        <PanelHeader
          title="Lịch sử hành trình"
          icon="trip"
          subtitle={
            initial
              ? `${initial.total} hành trình được suy ra từ GPS trong khoảng đã chọn`
              : "Chọn bộ lọc hợp lệ để tra cứu lịch sử GPS"
          }
          action={<Badge tone="warning">Traccar TEST</Badge>}
        />
        <form
          className="trip-filters"
          aria-label="Bộ lọc hành trình"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const from = utcDateTime(String(data.get("from")));
            const to = utcDateTime(String(data.get("to")));
            if (
              !from ||
              !to ||
              Date.parse(to) > Date.now() + 300000 ||
              Date.parse(to) <= Date.parse(from) ||
              Date.parse(to) - Date.parse(from) > 7 * 86400000
            ) {
              setError(
                "Chọn khoảng thời gian dương, tối đa 7 ngày và kết thúc không quá 5 phút trong tương lai.",
              );
              return;
            }
            navigate({
              ...filters,
              page: 1,
              vehicleId: vehicle.id,
              rentalId: rental.id,
              from,
              to,
              sort: String(data.get("sort")),
              limit: String(data.get("limit")),
            });
          }}
        >
          <div className="trip-filter-selection">
            <span className="trip-field-label">Xe</span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPicker("vehicle")}
              disabled={!context.permissions.includes("vehicle.read")}
            >
              {" "}
              {vehicle.label || "Chọn xe · Tất cả xe"}
            </Button>
            {vehicle.id && (
              <Button
                type="button"
                variant="ghost"
                aria-label="Bỏ lọc xe"
                onClick={() => setVehicle({ id: "", label: "" })}
              >
                Bỏ chọn
              </Button>
            )}
          </div>
          <div className="trip-filter-selection">
            <span className="trip-field-label">Hợp đồng</span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPicker("rental")}
              disabled={!context.permissions.includes("rental.read")}
            >
              {rental.label || "Chọn hợp đồng · Tất cả"}
            </Button>
            {rental.id && (
              <Button
                type="button"
                variant="ghost"
                aria-label="Bỏ lọc hợp đồng"
                onClick={() => setRental({ id: "", label: "" })}
              >
                Bỏ chọn
              </Button>
            )}
          </div>
          <label className="form-field">
            Từ lúc (giờ Việt Nam)
            <input
              required
              type="datetime-local"
              name="from"
              defaultValue={localInput(filters.from)}
            />
          </label>
          <label className="form-field">
            Đến lúc (giờ Việt Nam)
            <input
              required
              type="datetime-local"
              name="to"
              defaultValue={localInput(filters.to)}
            />
          </label>
          <label className="form-field">
            Thứ tự
            <select name="sort" defaultValue={filters.sort}>
              <option value="desc">Mới nhất trước</option>
              <option value="asc">Cũ nhất trước</option>
            </select>
          </label>
          <label className="form-field">
            Số dòng
            <select name="limit" defaultValue={filters.limit}>
              <option value="20">20 / trang</option>
              <option value="50">50 / trang</option>
              <option value="100">100 / trang</option>
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Đang tải…" : "Áp dụng bộ lọc"}
          </Button>
          <Link className="button button-ghost" href="/app/trips">
            24 giờ gần nhất
          </Link>
        </form>
        {(error || filterError) && (
          <p className="notice notice-danger" role="alert">
            {error || filterError}
          </p>
        )}
        <p className="trip-explanation">
          Giờ Việt Nam (UTC+7) · Tối đa 7 ngày mỗi truy vấn. Khoảng cách là ước
          tính giữa các điểm GPS, chưa xác nhận bằng odometer. Hợp đồng liên
          quan theo giao cắt lịch thuê, không khẳng định toàn bộ hành trình
          thuộc hợp đồng.
        </p>
        {initial && (
          <div aria-busy={pending}>
            {initial.data.length ? (
              <DataTable
                caption="Hành trình từ GPS TEST của doanh nghiệp"
                rows={initial.data}
                columns={[
                  {
                    key: "vehicle",
                    label: "Xe",
                    render: (trip) => (
                      <Link
                        className="fleet-record-link"
                        href={`/app/vehicles/${trip.vehicleId}`}
                      >
                        {trip.licensePlate}
                      </Link>
                    ),
                  },
                  {
                    key: "time",
                    label: "Bắt đầu / kết thúc (VN)",
                    render: (trip) => (
                      <>
                        <strong>{formatDate(trip.startedAt)}</strong>
                        <small className="fleet-cell-meta">
                          → {formatDate(trip.endedAt)}
                        </small>
                      </>
                    ),
                  },
                  {
                    key: "duration",
                    label: "Thời lượng",
                    render: (trip) => durationLabel(trip.durationSeconds),
                  },
                  {
                    key: "distance",
                    label: "Quãng đường ước tính",
                    render: (trip) => (
                      <>
                        {distanceLabel(trip.distanceMeters)}
                        <small className="fleet-cell-meta">
                          {trip.pointCount} điểm GPS · TEST
                        </small>
                      </>
                    ),
                  },
                  {
                    key: "quality",
                    label: "Dữ liệu",
                    render: (trip) => (
                      <div className="trip-badges">
                        <Badge tone={trip.partial ? "warning" : "neutral"}>
                          {trip.partial ? "Một phần" : "Được suy ra"}
                        </Badge>
                        <span>{freshnessLabels[trip.freshness]}</span>
                        <small className="fleet-cell-meta">
                          Ghi nhận: {formatDate(trip.lastRecordedAt)}
                        </small>
                      </div>
                    ),
                  },
                  {
                    key: "detail",
                    label: "Tuyến đường",
                    render: (trip) => (
                      <Link
                        className="button button-secondary"
                        href={`/app/trips/${encodeURIComponent(trip.id)}`}
                      >
                        Xem hành trình
                      </Link>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState
                icon="trip"
                title="Chưa có hành trình trong khoảng đã chọn"
                description="Thử đổi xe, hợp đồng hoặc thời gian. Chỉ những điểm GPS TEST đã nhận được mới được dùng để dựng hành trình."
              />
            )}
            <Pagination
              {...initial}
              onPage={(page) => navigate({ ...filters, page })}
            />
            <p className="trip-explanation">
              Cửa sổ tra cứu: {formatDate(initial.range.from)} →{" "}
              {formatDate(initial.range.to)}. Lưu lịch sử tối đa{" "}
              {initial.retentionDays} ngày; điểm cuối của thiết bị đang gắn có
              thể được giữ lâu hơn để hiển thị vị trí gần nhất.
            </p>
          </div>
        )}
      </Panel>
      {picker && (
        <Drawer
          title={
            picker === "vehicle"
              ? "Chọn xe để tra cứu"
              : "Chọn hợp đồng liên quan"
          }
          onClose={() => setPicker(null)}
        >
          <div className="panel-body">
            {picker === "vehicle" ? (
              <RecordPicker<Vehicle>
                businessId={context.business.id}
                path="/vehicles"
                title="Xe"
                selected={vehicle.id}
                onSelect={(item) => {
                  if (item) {
                    setVehicle({ id: item.id, label: item.licensePlate });
                    setPicker(null);
                  }
                }}
                render={(item) => (
                  <>
                    <strong>{item.licensePlate}</strong>
                    <small>
                      {item.make} {item.model}
                    </small>
                  </>
                )}
              />
            ) : (
              <RecordPicker<Rental>
                businessId={context.business.id}
                path="/rentals"
                title="Hợp đồng"
                selected={rental.id}
                onSelect={(item) => {
                  if (item) {
                    setRental({
                      id: item.id,
                      label: `#${item.id.slice(0, 8)} · ${item.vehicle.licensePlate}`,
                    });
                    setPicker(null);
                  }
                }}
                render={(item) => (
                  <>
                    <strong>
                      #{item.id.slice(0, 8)} · {item.vehicle.licensePlate}
                    </strong>
                    <small>
                      {item.customer.name} · {formatDate(item.startAt)} →{" "}
                      {formatDate(item.endAt)}
                    </small>
                  </>
                )}
              />
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}
