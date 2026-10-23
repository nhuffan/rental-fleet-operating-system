import Link from "next/link";
import { Panel, PanelHeader, Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/query";
import type { PlatformOverview } from "./types";
export function PlatformOverviewPanel({ data }: { data: PlatformOverview }) {
  const stats = [
    ["Doanh nghiệp hoạt động", data.businesses.ACTIVE, "business"],
    ["Liên kết Owner hoạt động", data.totals.activeMemberships, "users"],
    ["Xe trong hệ thống", data.totals.vehicles, "car"],
    ["Hợp đồng đang thuê", data.totals.activeRentals, "rental"],
  ] as const;
  return (
    <>
      <div className="stats-grid platform-live-stats">
        {stats.map(([label, value, icon]) => (
          <Panel className="compact-stat" key={label}>
            <div className="compact-stat-title">
              <span>{label}</span>
              <Icon name={icon} size={16} />
            </div>
            <strong>{value.toLocaleString("vi-VN")}</strong>
            <div className="stat-bottom">
              <small>Dữ liệu hệ thống hiện tại</small>
            </div>
          </Panel>
        ))}
      </div>
      <div className="fleet-profile-grid">
        <Panel>
          <PanelHeader
            title="Tổng quan vận hành"
            subtitle={`Tại ${formatDate(data.asOf)} · Giờ Việt Nam`}
            icon="business"
            action={<Badge tone="info">Chỉ đọc</Badge>}
          />
          <dl className="detail-list">
            <div>
              <dt>Doanh nghiệp</dt>
              <dd>
                {data.businesses.total} tổng · {data.businesses.DISABLED} đã vô
                hiệu hóa
              </dd>
            </div>
            <div>
              <dt>Chi nhánh</dt>
              <dd>
                {data.totals.activeBranches} hoạt động / {data.totals.branches}{" "}
                tổng
              </dd>
            </div>
            <div>
              <dt>Liên kết Owner</dt>
              <dd>
                {data.totals.activeMemberships} hoạt động /{" "}
                {data.totals.memberships} tổng
              </dd>
            </div>
            <div>
              <dt>Xe đang hoạt động</dt>
              <dd>
                {data.totals.activeVehicles} / {data.totals.vehicles}
              </dd>
            </div>
            <div>
              <dt>Hợp đồng</dt>
              <dd>
                {data.totals.rentals} tổng · {data.totals.reservedRentals} đã
                đặt · {data.totals.activeRentals} đang thuê
              </dd>
            </div>
          </dl>
          <div className="panel-body">
            <Link
              href="/superadmin/businesses"
              className="button button-secondary"
            >
              Xem doanh nghiệp →
            </Link>
          </div>
        </Panel>
        <Panel>
          <PanelHeader
            title="Tín hiệu GPS toàn nền tảng"
            subtitle="Vị trí gần nhất của thiết bị đang gắn · Không phải chứng nhận thiết bị vật lý"
            icon="signal"
            action={<Badge tone="warning">Traccar TEST</Badge>}
          />
          <dl className="detail-list">
            <div>
              <dt>Bản tin mới (≤120 giây)</dt>
              <dd>{data.gps.FRESH}</dd>
            </div>
            <div>
              <dt>Bản tin trễ (≤600 giây)</dt>
              <dd>{data.gps.STALE}</dd>
            </div>
            <div>
              <dt>Mất kết nối (&gt;600 giây)</dt>
              <dd>{data.gps.OFFLINE}</dd>
            </div>
            <div>
              <dt>Đã gắn, chưa có bản tin</dt>
              <dd>{data.gps.NO_DATA}</dd>
            </div>
            <div>
              <dt>Chưa gắn thiết bị</dt>
              <dd>{data.gps.UNASSIGNED}</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <p className="notice notice-info">
        Số liệu tổng hợp bao gồm tất cả doanh nghiệp theo trạng thái hiện có; số
        doanh nghiệp hoạt động được tách riêng. Liên kết Owner có thể đếm cùng
        một người ở nhiều doanh nghiệp. Console chỉ đọc metadata và tổng hợp,
        không hiển thị tọa độ, UID thiết bị hoặc thông tin liên hệ khách hàng.
      </p>
    </>
  );
}
