"use client";
import { formatDay, vietnamToday } from "@/features/fleet/vehicles/compliance";
import Link from "next/link";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  RefreshStatus,
} from "@/components/ui/primitives";
import { Combobox, FilterBar } from "@/components/ui/controls";
import { MetricCard } from "@/components/data-display/metric-card";
import { DataTable, Pagination } from "@/components/data-display/table";
import { formatDate, queryString } from "@/lib/query";
import {
  elapsed,
  kindLabels,
  severityLabels,
  type AlertFilters,
} from "./query";
import type { AlertPage, OperationalAlert } from "./types";
export function AlertsPanel({
  initial,
  filters,
}: {
  initial: AlertPage;
  filters: AlertFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (!pending && document.visibilityState === "visible")
        startTransition(() => router.refresh());
    };
    const timer = window.setInterval(refresh, initial.pollAfterSeconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, pending, initial.pollAfterSeconds]);
  function navigate(values: Record<string, string | number>) {
    startTransition(() =>
      router.push(`/app/alerts?${queryString(values)}`, { scroll: false }),
    );
  }
  function timing(alert: OperationalAlert) {
    if (alert.kind.startsWith("VEHICLE_") && alert.dueAt)
      return alert.severity === "CRITICAL"
        ? "Đã quá hạn — cập nhật hồ sơ xe sau khi gia hạn"
        : "Đến hạn trong 30 ngày tới";
    if (alert.kind === "RENTAL_DUE_SOON" && alert.dueAt) {
      return `Còn ${elapsed((new Date(alert.dueAt).getTime() - new Date(initial.asOf).getTime()) / 1000)}`;
    }
    return `${alert.kind === "GPS_STALE" ? "Chưa có bản tin mới trong" : "Quá hạn"} ${elapsed(alert.ageSeconds)}`;
  }
  const cards = [
    [
      "Quá hạn trả xe",
      initial.stats.rentalOverdue,
      "Hợp đồng đang thuê đã qua giờ trả.",
      "danger",
    ],
    [
      "Sắp đến hạn",
      initial.stats.rentalDueSoon,
      "Hợp đồng đang thuê đến hạn trong 24 giờ.",
      "warning",
    ],
    [
      "GPS TEST bị trễ",
      initial.stats.gpsStale,
      "Thiết bị đang gắn có bản tin thực tế cũ hơn 2 phút.",
      "info",
    ],
    [
      "Hồ sơ xe đến hạn",
      initial.stats.vehicleCompliance,
      "Đăng kiểm, bảo hiểm hoặc bảo dưỡng đã quá hạn/còn tối đa 30 ngày.",
      "warning",
    ],
  ] as const;
  return (
    <>
      <div className="alerts-summary-grid">
        {cards.map(([label, value, description, tone], index) => (
          <MetricCard
            key={label}
            label={label}
            value={value}
            description={description}
            tone={tone}
            icon={
              index === 3
                ? "shield"
                : index === 2
                  ? "signal"
                  : index === 1
                    ? "calendar"
                    : "clock"
            }
          />
        ))}
      </div>
      <Panel>
        <div className="panel-body alerts-explanation">
          <p>
            <strong>{initial.stats.total} cảnh báo đang tồn tại</strong> ·{" "}
            {initial.stats.critical} cần xử lý · {initial.stats.warning} cần
            theo dõi. Thẻ tổng hợp theo xe/hợp đồng đã chọn, trước bộ lọc loại
            và mức độ.
          </p>
          <p>
            GPS dùng nguồn TEST: trễ sau 2 phút, quá 10 phút chưa có bản tin mới
            tính từ bản tin gần nhất của thiết bị đang gắn. Không có bản tin
            hoặc không gắn thiết bị sẽ không tạo cảnh báo GPS. Cảnh báo tự biến
            mất khi dữ liệu vận hành không còn thỏa điều kiện.
          </p>
        </div>
      </Panel>
      <Panel>
        <PanelHeader
          title="Hộp cảnh báo"
          subtitle={`Cập nhật lúc ${formatDate(initial.asOf)} · Giờ Việt Nam · Tự cập nhật mỗi ${initial.pollAfterSeconds} giây khi mở trang`}
          icon="alert"
          action={
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              onClick={() => startTransition(() => router.refresh())}
            >
              Làm mới
            </Button>
          }
        />
        <FilterBar
          key={JSON.stringify(filters)}
          busy={pending}
          aria-label="Bộ lọc cảnh báo"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            navigate({
              ...filters,
              page: 1,
              kind: String(form.get("kind")),
              severity: String(form.get("severity")),
            });
          }}
        >
          <Combobox
            name="kind"
            label="Loại cảnh báo"
            defaultValue={filters.kind}
            options={[
              { value: "", label: "Mọi loại" },
              ...Object.entries(kindLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <Combobox
            name="severity"
            label="Mức độ"
            defaultValue={filters.severity}
            options={[
              { value: "", label: "Mọi mức độ" },
              ...Object.entries(severityLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <div className="filter-bar-actions">
            <Button variant="secondary" type="submit" loading={pending}>
              Áp dụng
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={pending}
              onClick={(event) => {
                event.currentTarget.form?.reset();
                navigate({ page: 1 });
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </FilterBar>
        {(filters.vehicleId || filters.rentalId) && (
          <div className="alerts-scope">
            {filters.vehicleId && (
              <Link
                className="fleet-record-link"
                href={`/app/vehicles/${filters.vehicleId}`}
              >
                Xe #{filters.vehicleId.slice(0, 8)}
              </Link>
            )}
            {filters.rentalId && (
              <Link
                className="fleet-record-link"
                href={`/app/rentals/${filters.rentalId}`}
              >
                Hợp đồng #{filters.rentalId.slice(0, 8)}
              </Link>
            )}
            <Button
              size="small"
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                navigate({ ...filters, page: 1, vehicleId: "", rentalId: "" })
              }
            >
              Bỏ giới hạn xe/hợp đồng
            </Button>
          </div>
        )}
        <div className="pending-region" aria-busy={pending}>
          <RefreshStatus pending={pending} />
          {initial.data.length ? (
            <DataTable
              caption="Cảnh báo vận hành trong doanh nghiệp"
              rows={initial.data}
              columns={[
                {
                  key: "severity",
                  label: "Mức độ",
                  render: (item) => (
                    <Badge
                      tone={item.severity === "CRITICAL" ? "danger" : "warning"}
                    >
                      {severityLabels[item.severity]}
                    </Badge>
                  ),
                },
                {
                  key: "alert",
                  label: "Cảnh báo",
                  render: (item) => (
                    <>
                      <strong>{kindLabels[item.kind]}</strong>
                      <small className="fleet-cell-meta">{timing(item)}</small>
                      {item.sourceMode === "TEST" && (
                        <Badge tone="info">
                          GPS TEST ·{" "}
                          {item.gpsState === "OFFLINE"
                            ? "Bản tin quá 10 phút"
                            : "Bản tin trễ"}
                        </Badge>
                      )}
                    </>
                  ),
                },
                {
                  key: "vehicle",
                  label: "Xe",
                  render: (item) => (
                    <Link
                      className="fleet-record-link"
                      href={`/app/vehicles/${item.vehicleId}`}
                    >
                      {item.licensePlate}
                    </Link>
                  ),
                },
                {
                  key: "time",
                  label: "Mốc thời gian (VN)",
                  render: (item) => (
                    <>
                      {item.dueAt && item.kind.startsWith("VEHICLE_")
                        ? `Hạn: ${formatDay(vietnamToday(new Date(item.dueAt)))}`
                        : item.dueAt
                        ? `Hạn trả: ${formatDate(item.dueAt)}`
                        : item.lastSeenAt
                          ? `Bản tin: ${formatDate(item.lastSeenAt)}`
                          : "Không khả dụng"}
                    </>
                  ),
                },
                {
                  key: "action",
                  label: "Xử lý",
                  render: (item) => (
                    <div className="alerts-links">
                      {item.rentalId && (
                        <Link
                          className="fleet-record-link"
                          href={`/app/rentals/${item.rentalId}`}
                        >
                          Mở hợp đồng
                        </Link>
                      )}
                      <Link
                        className="fleet-record-link"
                        href={`/app/vehicles/${item.vehicleId}`}
                      >
                        Xem xe
                      </Link>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState
              title="Không có cảnh báo phù hợp"
              description="Không có dữ liệu thỏa các điều kiện cảnh báo và bộ lọc hiện tại."
              icon="check"
            />
          )}
          <Pagination
            {...initial}
            disabled={pending}
            onPage={(page) => navigate({ ...filters, page })}
          />
        </div>
      </Panel>
    </>
  );
}
