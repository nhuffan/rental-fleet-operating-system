import Link from "next/link";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { gpsLabels, type VehicleLocation } from "./types";
const date = (s: string) =>
  new Date(s).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
export function VehicleLocationPanel({ data }: { data: VehicleLocation }) {
  return (
    <Panel className="gps-panel">
      <PanelHeader
        icon="pin"
        title="Vị trí gần nhất"
        subtitle="Theo lần gắn thiết bị hiện tại · tải lại trang để cập nhật"
        action={
          <Badge
            tone={
              data.state === "FRESH"
                ? "success"
                : data.state === "STALE"
                  ? "warning"
                  : "neutral"
            }
          >
            {gpsLabels[data.state]}
          </Badge>
        }
      />
      <div className="panel-body">
        {data.location ? (
          <>
            <Badge tone="warning">TEST FEED</Badge>
            <p>
              {data.location.latitude.toFixed(6)},{" "}
              {data.location.longitude.toFixed(6)} ·{" "}
              {data.location.speedKph.toFixed(1)} km/h
            </p>
            <p>GPS ghi nhận: {date(data.location.recordedAt)} · giờ VN</p>
            <p>Nhận tại hệ thống: {date(data.location.receivedAt)} · giờ VN</p>
          </>
        ) : (
          <p>
            Chưa có dữ liệu vị trí. Đăng ký hoặc gắn thiết bị không đồng nghĩa
            với việc đã có tín hiệu.
          </p>
        )}
        <Link className="link-brand" href="/app/fleet-map">
          Mở bản đồ đội xe →
        </Link>
      </div>
    </Panel>
  );
}
