"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { LocationMap } from "./location-map";
import { gpsDescriptions, gpsLabels, type LocationPage } from "./types";
const date = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "—";
export function LiveFleetMap({
  initial,
  businessId,
  compact = false,
}: {
  initial: LocationPage;
  businessId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState({
    payload: initial,
    scope: JSON.stringify({ search: "", state: "", page: 1 }),
  });
  const { payload } = snapshot;
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ search: "", state: "", page: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function refresh() {
      if (stopped || document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setBusy(true);
      try {
        const {
          data: { session },
        } = await browserClient().auth.getSession();
        if (stopped || signal.aborted) return;
        if (!session) {
          router.replace("/login");
          return;
        }
        const params = new URLSearchParams({
          limit: "20",
          page: String(filters.page),
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.state ? { state: filters.state } : {}),
        });
        const response = await fetch(
          `${publicEnv().api}/api/v1/fleet/locations?${params}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "X-Business-Id": businessId,
            },
            signal,
            cache: "no-store",
          },
        );
        if (stopped || signal.aborted) return;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (response.status === 403) {
          router.replace("/access-denied");
          return;
        }
        if (!response.ok) throw new Error("API");
        const next = (await response.json()) as LocationPage;
        if (!stopped && !signal.aborted) {
          setSnapshot({ payload: next, scope: JSON.stringify(filters) });
          setError("");
        }
      } catch {
        if (!stopped && !signal.aborted)
          setError(
            "Không thể cập nhật GPS. Dữ liệu bên dưới là lần tải thành công gần nhất; trạng thái có thể đã thay đổi.",
          );
      } finally {
        if (!stopped && !signal.aborted) {
          setBusy(false);
          timer = setTimeout(refresh, 20000);
        }
      }
    }
    const visibility = () => {
      clearTimeout(timer);
      if (document.hidden) {
        controller?.abort();
        setBusy(false);
      } else void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [businessId, filters, router, refreshKey]);
  const active = payload.data.find((v) => v.vehicleId === selected);
  const pagePending = busy || snapshot.scope !== JSON.stringify(filters);
  return (
    <Panel className="gps-panel">
      <PanelHeader
        icon="map"
        title={compact ? "Vị trí đội xe" : "Bản đồ & tín hiệu GPS"}
        subtitle="Traccar TEST feed · GPS thử nghiệm qua pipeline thật"
        action={<Badge tone="warning">TEST FEED</Badge>}
      />
      <div className="gps-stats">
        {Object.entries(payload.stats).map(([state, n]) => (
          <span key={state}>
            <strong>{n}</strong>
            {gpsLabels[state]}
          </span>
        ))}
      </div>
      {!compact && (
        <form
          className="gps-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, search: query, page: 1 }));
            setSelected(null);
          }}
        >
          <input
            className="search-input"
            aria-label="Tìm xe trên bản đồ"
            placeholder="Biển số, hãng, dòng xe…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="filter-select"
            aria-label="Trạng thái GPS"
            value={filters.state}
            onChange={(e) => {
              setFilters((f) => ({ ...f, state: e.target.value, page: 1 }));
              setSelected(null);
            }}
          >
            <option value="">Tất cả GPS</option>
            {Object.entries(gpsLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Tìm xe
          </Button>
        </form>
      )}
      {error && (
        <div role="alert" className="notice error">
          <p>{error}</p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Thử cập nhật GPS lại
          </Button>
        </div>
      )}
      <p className="gps-sync" role="status">
        {busy
          ? `Đang cập nhật GPS… · Đang hiển thị lần tải ${date(payload.asOf)} (giờ VN)`
          : `Lần tải: ${date(payload.asOf)} · giờ VN · cập nhật mỗi 20 giây khi mở trang`}
      </p>
      <div
        className={`gps-content pending-region ${compact ? "gps-compact" : ""}`}
        aria-busy={busy}
      >
        <LocationMap
          fitKey={snapshot.scope}
          data={payload.data}
          onSelect={setSelected}
        />
        <div className="gps-location-list" aria-label="Xe trong trang hiện tại">
          {payload.data.map((v) => (
            <button
              className={`gps-location-row ${selected === v.vehicleId ? "selected" : ""}`}
              key={v.vehicleId}
              onClick={() => setSelected(v.vehicleId)}
              aria-pressed={selected === v.vehicleId}
            >
              <strong>{v.licensePlate}</strong>
              <span>
                {v.make} {v.model}
              </span>
              <Badge
                tone={
                  v.state === "FRESH"
                    ? "success"
                    : v.state === "STALE"
                      ? "warning"
                      : "neutral"
                }
              >
                {gpsLabels[v.state]}
              </Badge>
              <small>Vị trí cuối: {date(v.lastSeenAt)}</small>
              {v.location && (
                <small>TEST · {v.location.speedKph.toFixed(1)} km/h</small>
              )}
            </button>
          ))}
          {!payload.data.length && (
            <EmptyState
              title="Không có xe phù hợp"
              description="Thử bỏ bộ lọc hoặc thêm xe vào doanh nghiệp."
            />
          )}
        </div>
      </div>
      {active && (
        <div className="gps-selected" aria-live="polite">
          <div>
            <strong>{active.licensePlate}</strong> · {gpsLabels[active.state]}
            <p>{gpsDescriptions[active.state]}</p>
            {active.location && (
              <>
                <p>
                  TEST · {active.location.latitude.toFixed(6)},{" "}
                  {active.location.longitude.toFixed(6)} ·{" "}
                  {active.location.speedKph.toFixed(1)} km/h · Hướng{" "}
                  {active.location.heading}°
                </p>
                <p>
                  GPS ghi nhận: {date(active.location.recordedAt)} · Nhận:{" "}
                  {date(active.location.receivedAt)} · giờ VN
                </p>
              </>
            )}
          </div>
          <div className="inline">
            <Link
              className="button button-secondary"
              href={`/app/vehicles/${active.vehicleId}`}
            >
              Chi tiết xe →
            </Link>
            {active.currentRentalId && (
              <Link
                className="button button-secondary"
                href={`/app/rentals/${active.currentRentalId}`}
              >
                Hợp đồng đang thuê →
              </Link>
            )}
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Đóng
            </Button>
          </div>
        </div>
      )}
      <div className="gps-footer">
        <span>
          {payload.total} xe phù hợp · Marker chỉ thuộc trang hiện tại. Ngưỡng:
          mới ≤2 phút; trễ ≤10 phút; sau đó mất kết nối.
        </span>
        {compact ? (
          <Link className="link-brand" href="/app/fleet-map">
            Mở bản đồ đội xe →
          </Link>
        ) : (
          <div className="inline">
            <Button
              variant="secondary"
              disabled={pagePending || filters.page <= 1}
              onClick={() => {
                setFilters((f) => ({ ...f, page: f.page - 1 }));
                setSelected(null);
              }}
            >
              ← Trước
            </Button>
            <span>Trang {payload.page}</span>
            <Button
              variant="secondary"
              disabled={pagePending || filters.page * 20 >= payload.total}
              onClick={() => {
                setFilters((f) => ({ ...f, page: f.page + 1 }));
                setSelected(null);
              }}
            >
              Sau →
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
