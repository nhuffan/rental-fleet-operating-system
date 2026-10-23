"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import type { VehicleLocation } from "./types";
export function LocationMap({
  data,
  fitKey = "initial",
  onSelect,
}: {
  data: VehicleLocation[];
  fitKey?: string;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const fitted = useRef<string | null>(null);
  const [runtime, setRuntime] = useState<{
    L: typeof Leaflet;
    map: Leaflet.Map;
    markers: Leaflet.LayerGroup;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | undefined;
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
                "Không tải được nền bản đồ. Danh sách và tọa độ vẫn khả dụng.",
              );
          })
          .addTo(map);
        const markers = L.layerGroup().addTo(map);
        setRuntime({ L, map, markers });
        const observer = new ResizeObserver(() => map?.invalidateSize());
        observer.observe(container.current);
        cleanupObserver = () => observer.disconnect();
      })
      .catch(() => {
        if (!cancelled)
          setError("Không tải được bản đồ. Hãy thử tải lại trang.");
      });
    let cleanupObserver = () => {};
    return () => {
      cancelled = true;
      cleanupObserver();
      map?.remove();
      fitted.current = null;
    };
  }, []);
  useEffect(() => {
    if (!runtime) return;
    const { L, map, markers } = runtime;
    markers.clearLayers();
    const bounds: Leaflet.LatLngTuple[] = [];
    data.forEach((v) => {
      if (!v.location) return;
      const p = v.location;
      const point: Leaflet.LatLngTuple = [p.latitude, p.longitude];
      bounds.push(point);
      const marker = L.marker(point, {
        title: `${v.licensePlate} · TEST · ${v.state}`,
        icon: L.divIcon({
          className: `gps-map-pin gps-pin-${v.state.toLowerCase()}`,
          html: '<span aria-hidden="true">●</span>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      });
      const label = document.createElement("span");
      label.textContent = v.licensePlate + " · TEST";
      marker.bindTooltip(label);
      marker.on("click", () => select.current(v.vehicleId));
      marker.addTo(markers);
    });
    if (bounds.length && fitted.current !== fitKey) {
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 14 });
      fitted.current = fitKey;
    }
  }, [runtime, data, fitKey]);
  return (
    <div className="gps-map-wrap">
      <div
        ref={container}
        className="gps-live-canvas"
        role="region"
        aria-label="Bản đồ vị trí xe · Traccar TEST"
      />
      {!runtime && !error && (
        <div className="map-initial-loading" role="status">
          <Skeleton className="skeleton-panel" />
          <p>Đang mở bản đồ…</p>
        </div>
      )}
      {runtime && !data.some((v) => v.location) && (
        <div className="gps-map-empty">
          <EmptyState
            title="Chưa có dữ liệu vị trí"
            description="Thiết bị đã đăng ký hoặc gắn vào xe chưa có nghĩa là đang có tín hiệu GPS."
            icon="map"
          />
        </div>
      )}
      {error && (
        <p role="status" className="notice warning">
          {error}
        </p>
      )}
    </div>
  );
}
