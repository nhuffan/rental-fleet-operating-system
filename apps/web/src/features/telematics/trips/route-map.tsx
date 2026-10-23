"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Skeleton } from "@/components/ui/primitives";
import type { TripPoint } from "./types";
export function RouteMap({
  points,
  selected,
}: {
  points: TripPoint[];
  selected: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [runtime, setRuntime] = useState<{
    L: typeof Leaflet;
    map: Leaflet.Map;
    route: Leaflet.LayerGroup;
    cursor: Leaflet.LayerGroup;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | undefined;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        map = L.map(container.current, { scrollWheelZoom: false }).setView(
          [10.7769, 106.7009],
          12,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => {
            if (!cancelled)
              setError(
                "Không tải được nền bản đồ. Tọa độ và timeline GPS vẫn khả dụng.",
              );
          })
          .addTo(map);
        setRuntime({
          L,
          map,
          route: L.layerGroup().addTo(map),
          cursor: L.layerGroup().addTo(map),
        });
        observer = new ResizeObserver(() => map?.invalidateSize());
        observer.observe(container.current);
      })
      .catch(() => {
        if (!cancelled)
          setError("Không tải được bản đồ. Hãy thử tải lại trang.");
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
    };
  }, []);
  useEffect(() => {
    if (!runtime || !points.length) return;
    const { L, map, route } = runtime;
    route.clearLayers();
    let segment: Leaflet.LatLngTuple[] = [];
    function drawSegment() {
      if (segment.length > 1)
        L.polyline(segment, { color: "var(--brand)", weight: 4 }).addTo(route);
    }
    points.forEach((point) => {
      if (point.breakBefore) {
        drawSegment();
        segment = [];
      }
      segment.push([point.latitude, point.longitude]);
    });
    drawSegment();
    [points[0], points[points.length - 1]].forEach((point, index) => {
      const label = document.createElement("span");
      label.textContent =
        index === 0
          ? "Bắt đầu phần tuyến đang xem · TEST"
          : "Kết thúc phần tuyến đang xem · TEST";
      L.circleMarker([point.latitude, point.longitude], {
        radius: 8,
        color: "white",
        weight: 3,
        fillColor: index === 0 ? "var(--success)" : "var(--brand)",
        fillOpacity: 1,
      })
        .bindTooltip(label)
        .addTo(route);
    });
    map.fitBounds(
      points.map(
        (point) => [point.latitude, point.longitude] as Leaflet.LatLngTuple,
      ),
      { padding: [35, 35], maxZoom: 16 },
    );
  }, [runtime, points]);
  useEffect(() => {
    if (!runtime) return;
    runtime.cursor.clearLayers();
    const point = points[selected];
    if (!point) return;
    runtime.L.circleMarker([point.latitude, point.longitude], {
      radius: 6,
      color: "var(--text-primary)",
      weight: 3,
      fillColor: "white",
      fillOpacity: 1,
    }).addTo(runtime.cursor);
    runtime.map.panInside([point.latitude, point.longitude], {
      padding: [30, 30],
      animate: false,
    });
  }, [runtime, points, selected]);
  return (
    <div className="gps-map-wrap">
      <div
        ref={container}
        className="gps-live-canvas trip-route-canvas"
        role="region"
        aria-label="Tuyến đường lịch sử GPS TEST; đường thẳng nối các điểm đã ghi nhận"
      />
      {!runtime && !error && (
        <div className="map-initial-loading" role="status">
          <Skeleton className="skeleton-panel" />
          <p>Đang mở bản đồ tuyến đường…</p>
        </div>
      )}
      {error && (
        <p className="notice notice-warning" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
