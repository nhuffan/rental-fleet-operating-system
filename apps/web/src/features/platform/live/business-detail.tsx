import Link from "next/link";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/query";
import type { PlatformBusiness } from "./types";
import { MetricCard } from "@/components/data-display/metric-card";
import { PlatformGpsHealth, PlatformIdentity } from "./presentation";
export function PlatformBusinessDetail({
  business: b,
}: {
  business: PlatformBusiness;
}) {
  return (
    <>
      <Panel>
        <div className="tenant-detail-hero">
          <PlatformIdentity
            name={b.name}
            subtitle={`${b.timezone} · ${b.currency}`}
          />
          <Badge tone={b.status === "ACTIVE" ? "success" : "neutral"}>
            {b.status === "ACTIVE" ? "Hoạt động" : "Đã vô hiệu hóa"}
          </Badge>
          <Badge tone="info">Chỉ đọc</Badge>
        </div>
      </Panel>
      <div className="panel-body inline">
        <Link
          className="button button-secondary"
          href={`/superadmin/users?businessId=${b.id}`}
        >
          Người dùng doanh nghiệp
        </Link>
        <Link
          className="button button-secondary"
          href={`/superadmin/audit?businessId=${b.id}`}
        >
          Nhật ký platform liên quan
        </Link>
      </div>
      <div className="metric-grid platform-detail-metrics">
        <MetricCard
          label="Xe đang hoạt động"
          value={b.counts.activeVehicles}
          description={`${b.counts.vehicles} xe đã đăng ký`}
          icon="car"
          tone="brand"
        />
        <MetricCard
          label="Hợp đồng đang thuê"
          value={b.counts.activeRentals}
          description={`${b.counts.reservedRentals} đã đặt · ${b.counts.rentals} tổng`}
          icon="rental"
        />
        <MetricCard
          label="Liên kết Owner hoạt động"
          value={b.counts.activeMemberships}
          description={`${b.counts.memberships} tổng liên kết`}
          icon="users"
        />
        <MetricCard
          label="GPS bản tin mới · TEST"
          value={b.gps.FRESH}
          description="Trong vòng 120 giây"
          icon="signal"
          tone="success"
        />
      </div>
      <div className="fleet-profile-grid platform-live-detail">
        <Panel>
          <PanelHeader title="Thông tin doanh nghiệp" icon="business" />
          <dl className="detail-list">
            <div>
              <dt>Mã doanh nghiệp</dt>
              <dd className="rental-id">{b.id}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{b.status === "ACTIVE" ? "Hoạt động" : "Đã vô hiệu hóa"}</dd>
            </div>
            <div>
              <dt>Múi giờ</dt>
              <dd>{b.timezone}</dd>
            </div>
            <div>
              <dt>Tiền tệ</dt>
              <dd>{b.currency}</dd>
            </div>
            <div>
              <dt>Tạo lúc (VN)</dt>
              <dd>{formatDate(b.createdAt)}</dd>
            </div>
            <div>
              <dt>Cập nhật lúc (VN)</dt>
              <dd>{formatDate(b.updatedAt)}</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Nguồn lực & hợp đồng" icon="car" />
          <dl className="detail-list">
            <div>
              <dt>Chi nhánh</dt>
              <dd>
                {b.counts.activeBranches} hoạt động / {b.counts.branches} tổng
              </dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>
                {b.counts.activeMemberships} hoạt động / {b.counts.memberships}{" "}
                tổng
              </dd>
            </div>
            <div>
              <dt>Đội xe</dt>
              <dd>
                {b.counts.activeVehicles} hoạt động / {b.counts.vehicles} tổng
              </dd>
            </div>
            <div>
              <dt>Hợp đồng</dt>
              <dd>{b.counts.rentals} tổng</dd>
            </div>
            <div>
              <dt>Đang thuê / đã đặt</dt>
              <dd>
                {b.counts.activeRentals} / {b.counts.reservedRentals}
              </dd>
            </div>
          </dl>
          <p className="panel-body quiet">
            Mỗi liên kết cấp quyền Owner cho một doanh nghiệp. Quyền hiệu lực
            cần liên kết và hồ sơ người dùng cùng hoạt động.
          </p>
        </Panel>
        <Panel>
          <PanelHeader
            title="Tình trạng GPS"
            icon="signal"
            action={<Badge tone="warning">TEST feed</Badge>}
          />
          <div className="panel-body">
            <PlatformGpsHealth gps={b.gps} />
          </div>
          <p className="panel-body quiet">
            Tổng hợp vị trí gần nhất theo thiết bị đang gắn; không tải tọa độ
            hoặc lịch sử. Chưa xác minh thiết bị GPS vật lý.
          </p>
        </Panel>
        <Panel>
          <PanelHeader title="Phạm vi hỗ trợ" icon="shield" />
          <div className="panel-body">
            <p>
              Console hiện cung cấp metadata và số liệu tổng hợp. Quản lý trạng
              thái, cấu hình và quyền của doanh nghiệp chưa được triển khai.
            </p>
            <p className="quiet">
              Có thể tra cứu người dùng và nhật ký platform qua các liên kết
              phía trên. Quản lý tính năng, tích hợp và cài đặt hệ thống chưa
              khả dụng; console không cấp quyền vận hành Owner hoặc truy cập tài
              chính doanh nghiệp.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
