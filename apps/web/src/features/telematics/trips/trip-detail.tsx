"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  RefreshStatus,
} from "@/components/ui/primitives";
import { formatDate, queryString } from "@/lib/query";
import { distanceLabel, durationLabel, partialLabel } from "./query";
import { RouteMap } from "./route-map";
import type { Trip, TripRoute } from "./types";
export function TripDetail({
  trip,
  route,
  canReadRental,
}: {
  trip: Trip;
  route: TripRoute;
  canReadRental: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selection, setSelection] = useState({ page: route.page, index: 0 });
  const selected = selection.page === route.page ? selection.index : 0;
  const setSelected = (index: number) =>
    setSelection({ page: route.page, index });
  const points = useMemo(() => route.data.slice(0, 500), [route.data]);
  const index = Math.min(selected, Math.max(0, points.length - 1));
  const point = points[index];
  const reasons = [
    ...new Set([...trip.partialReasons, ...route.partialReasons]),
  ];
  const href = `/app/trips/${encodeURIComponent(trip.id)}`;
  return (
    <>
      <div className="trip-summary-grid">
        <Panel>
          <div className="trip-summary-stat">
            <span>Quãng đường ước tính</span>
            <strong>{distanceLabel(trip.distanceMeters)}</strong>
            <small>Đường thẳng giữa điểm GPS hợp lệ</small>
          </div>
        </Panel>
        <Panel>
          <div className="trip-summary-stat">
            <span>Thời lượng ghi nhận</span>
            <strong>{durationLabel(trip.durationSeconds)}</strong>
            <small>
              {formatDate(trip.startedAt)} → {formatDate(trip.endedAt)}
            </small>
          </div>
        </Panel>
        <Panel>
          <div className="trip-summary-stat">
            <span>Số điểm GPS</span>
            <strong>{trip.pointCount.toLocaleString("vi-VN")}</strong>
            <small>Traccar TEST · Hành trình được suy ra</small>
          </div>
        </Panel>
      </div>
      <Panel className="trip-panel">
        <PanelHeader
          title="Xem lại tuyến đường"
          icon="map"
          subtitle="Lịch sử tĩnh · Chọn từng điểm GPS, không nội suy chuyển động"
          action={
            <div className="trip-badges">
              <Badge tone="warning">TEST feed</Badge>
              <Badge tone={trip.partial ? "warning" : "neutral"}>
                {trip.partial ? "Dữ liệu một phần" : "Được suy ra"}
              </Badge>
            </div>
          }
        />
        {(trip.partial || route.partial || route.hasMore || route.page > 1) && (
          <div className="trip-quality notice notice-warning" role="status">
            <strong>Tuyến hiển thị có giới hạn.</strong>{" "}
            {reasons.map(partialLabel).join(" · ")}
            {(route.hasMore || route.page > 1) &&
              " Chỉ vẽ các điểm trong trang tuyến đang xem; không nối giữa các trang."}
          </div>
        )}
        {points.length ? (
          <div className="pending-region" aria-busy={pending}>
            <RefreshStatus
              pending={pending}
              label="Đang tải trang tuyến tiếp theo · Giữ tuyến đang xem…"
            />
            <RouteMap points={points} selected={index} />
            <div className="trip-replay">
              <div className="trip-replay-heading" aria-live="polite">
                <strong>
                  Điểm {(route.page - 1) * route.limit + index + 1} /{" "}
                  {route.total}
                </strong>
                <span>{point && formatDate(point.recordedAt)} (VN)</span>
              </div>
              <label className="trip-scrubber">
                <span>Chọn điểm trên timeline</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, points.length - 1)}
                  step="1"
                  value={index}
                  disabled={points.length < 2}
                  onChange={(event) => setSelected(Number(event.target.value))}
                  aria-valuetext={
                    point
                      ? `Điểm ${index + 1}, ${formatDate(point.recordedAt)}`
                      : "Chưa có điểm"
                  }
                />
              </label>
              <div className="trip-replay-actions">
                <Button
                  variant="secondary"
                  disabled={index === 0}
                  onClick={() => setSelected(0)}
                >
                  Đầu trang tuyến
                </Button>
                <Button
                  variant="secondary"
                  disabled={index === 0}
                  onClick={() => setSelected(index - 1)}
                >
                  ← Điểm trước
                </Button>
                <Button
                  variant="secondary"
                  disabled={index >= points.length - 1}
                  onClick={() => setSelected(index + 1)}
                >
                  Điểm sau →
                </Button>
                <Button
                  variant="secondary"
                  disabled={index >= points.length - 1}
                  onClick={() => setSelected(points.length - 1)}
                >
                  Cuối trang tuyến
                </Button>
              </div>
              {point && (
                <dl className="trip-point-data">
                  <div>
                    <dt>Tọa độ</dt>
                    <dd>
                      {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                    </dd>
                  </div>
                  <div>
                    <dt>Vận tốc GPS</dt>
                    <dd>
                      {point.speedKph === null
                        ? "Không có dữ liệu"
                        : `${point.speedKph.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km/h`}
                    </dd>
                  </div>
                  <div>
                    <dt>Ignition</dt>
                    <dd>
                      {point.ignition === null
                        ? "Không xác định"
                        : point.ignition
                          ? "Bật"
                          : "Tắt"}
                    </dd>
                  </div>
                  <div>
                    <dt>Server nhận lúc (VN)</dt>
                    <dd>{formatDate(point.receivedAt)}</dd>
                  </div>
                </dl>
              )}
              <div className="trip-route-pagination">
                <span>
                  Trang tuyến {route.page} · {points.length} / tối đa 500 điểm
                  mỗi trang
                </span>
                <div className="inline">
                  {route.page > 1 && (
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          router.push(`${href}?routePage=${route.page - 1}`, {
                            scroll: false,
                          }),
                        )
                      }
                    >
                      ← Trang tuyến trước
                    </Button>
                  )}
                  {route.hasMore && (
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          router.push(`${href}?routePage=${route.page + 1}`, {
                            scroll: false,
                          }),
                        )
                      }
                    >
                      Trang tuyến sau →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="map"
            title="Không có điểm tuyến trong trang này"
            description="GPS history có thể đã thay đổi sau khi nhận bản tin trễ hoặc do giới hạn lưu trữ. Hãy mở lại danh sách hành trình."
          />
        )}
        <p className="trip-explanation">
          Bản đồ nối các điểm đã ghi nhận, không phải tuyến đường theo mạng lưới
          giao thông. Điểm bắt đầu/kết thúc là biên phần tuyến đang xem. Một
          điểm đơn lẻ chưa đủ để xác định đường đi. Thiết bị GPS vật lý chưa
          được xác minh.
        </p>
      </Panel>
      <div className="fleet-profile-grid">
        <Panel>
          <PanelHeader title="Nguồn & thời gian" icon="signal" />
          <dl className="detail-list">
            <div>
              <dt>Xe</dt>
              <dd>
                <Link
                  className="fleet-record-link"
                  href={`/app/vehicles/${trip.vehicleId}`}
                >
                  {trip.licensePlate}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Phân loại</dt>
              <dd>Hành trình suy ra · Khoảng cách ước tính · TEST</dd>
            </div>
            <div>
              <dt>Bản tin cuối (VN)</dt>
              <dd>
                {formatDate(trip.lastRecordedAt)} ·{" "}
                {trip.freshness === "FRESH"
                  ? "Mới"
                  : trip.freshness === "STALE"
                    ? "Trễ"
                    : "Cũ"}
              </dd>
            </div>
            <div>
              <dt>Nhận bản tin cuối (VN)</dt>
              <dd>{formatDate(trip.lastReceivedAt)}</dd>
            </div>
            <div>
              <dt>Khoảng tra cứu (VN)</dt>
              <dd>
                {formatDate(trip.range.from)} → {formatDate(trip.range.to)}
              </dd>
            </div>
          </dl>
          <p className="trip-explanation">
            Hành trình tính theo thời gian ghi nhận và lịch sử gắn thiết bị. Bản
            tin đến trễ hoặc dữ liệu hết hạn lưu trữ có thể làm thay đổi kết
            quả; tra cứu lại từ danh sách khi liên kết không còn hợp lệ.
          </p>
        </Panel>
        <Panel>
          <PanelHeader title="Hợp đồng liên quan" icon="rental" />
          <div className="panel-body">
            {trip.rentalAssociations.length ? (
              <ul className="trip-rental-links">
                {trip.rentalAssociations.map((association) => (
                  <li key={association.rentalId}>
                    {canReadRental ? (
                      <Link
                        className="fleet-record-link"
                        href={`/app/rentals/${association.rentalId}`}
                      >
                        Hợp đồng #{association.rentalId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span>Hợp đồng #{association.rentalId.slice(0, 8)}</span>
                    )}
                    <small>
                      {association.relation === "CONTAINED"
                        ? "Hành trình nằm trong lịch thuê"
                        : "Giao cắt một phần lịch thuê"}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Không có lịch thuê giao cắt hành trình này.</p>
            )}
            <p className="quiet">
              Liên kết theo khoảng thời gian dự kiến của hợp đồng cùng xe, không
              xác nhận người điều khiển hoặc toàn bộ chuyến đi thuộc hợp đồng.
            </p>
          </div>
        </Panel>
      </div>
      <Link
        className="button button-secondary"
        href={`/app/trips?${queryString({ vehicleId: trip.vehicleId, ...trip.range })}`}
      >
        Xem các hành trình cùng xe trong khoảng này
      </Link>
    </>
  );
}
