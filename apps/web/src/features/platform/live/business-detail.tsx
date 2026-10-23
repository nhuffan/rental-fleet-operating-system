import Link from "next/link";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/query";
import type { PlatformBusiness } from "./types";
export function PlatformBusinessDetail({
  business: b,
}: {
  business: PlatformBusiness;
}) {
  return (
    <>
      <Panel>
        <div className="tenant-detail-hero">
          <span className="tenant-avatar">
            {b.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h2>{b.name}</h2>
            <p>
              {b.timezone} · {b.currency}
            </p>
          </div>
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
              <dt>Memberships</dt>
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
            Liên kết thành viên không phải tài khoản duy nhất. Membership hoạt
            động cần liên kết và hồ sơ người dùng cùng hoạt động.
          </p>
        </Panel>
        <Panel>
          <PanelHeader
            title="Tình trạng GPS"
            icon="signal"
            action={<Badge tone="warning">TEST feed</Badge>}
          />
          <dl className="detail-list">
            <div>
              <dt>Tín hiệu mới</dt>
              <dd>{b.gps.FRESH}</dd>
            </div>
            <div>
              <dt>Tín hiệu trễ</dt>
              <dd>{b.gps.STALE}</dd>
            </div>
            <div>
              <dt>Mất kết nối</dt>
              <dd>{b.gps.OFFLINE}</dd>
            </div>
            <div>
              <dt>Chưa có bản tin</dt>
              <dd>{b.gps.NO_DATA}</dd>
            </div>
            <div>
              <dt>Chưa gắn thiết bị</dt>
              <dd>{b.gps.UNASSIGNED}</dd>
            </div>
          </dl>
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
              Global Users, Audit, Features, Integrations và System Settings
              chưa có API live trong giai đoạn này.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
