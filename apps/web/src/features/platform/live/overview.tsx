"use client";
import Link from "next/link";
import {
  Panel,
  PanelHeader,
  Badge,
  EmptyState,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { MetricCard } from "@/components/data-display/metric-card";
import { DataTable } from "@/components/data-display/table";
import { formatDate, queryString } from "@/lib/query";
import { auditLabels } from "./query";
import { PlatformGpsHealth, PlatformIdentity } from "./presentation";
import type {
  PlatformOverview,
  PlatformBusinessPage,
  PlatformAuditPage,
} from "./types";

export function PlatformOverviewPanel({
  data,
  businesses,
  activity,
}: {
  data: PlatformOverview;
  businesses?: PlatformBusinessPage;
  activity?: PlatformAuditPage;
}) {
  const gpsAttention = data.gps.STALE + data.gps.OFFLINE;
  return (
    <>
      <div className="platform-snapshot-strip">
        <span>
          <Icon name="clock" size={16} /> Cập nhật {formatDate(data.asOf)} · Giờ
          Việt Nam
        </span>
        <span>
          {data.totals.vehicles.toLocaleString("vi-VN")} xe ·{" "}
          {data.totals.activeRentals.toLocaleString("vi-VN")} đang thuê ·{" "}
          {data.totals.reservedRentals.toLocaleString("vi-VN")} đã đặt
        </span>
      </div>
      <div className="platform-live-dashboard">
        <Panel className="platform-business-health">
          <PanelHeader
            title="Sức khỏe doanh nghiệp"
            subtitle={
              businesses
                ? `Hiển thị ${businesses.data.length} / ${businesses.total} doanh nghiệp · Theo tên A–Z`
                : "Phân quyền xem doanh nghiệp độc lập"
            }
            icon="business"
            action={
              businesses && (
                <Link className="link-brand" href="/superadmin/businesses">
                  Xem tất cả <Icon name="arrow" size={15} />
                </Link>
              )
            }
          />
          {businesses ? (
            businesses.data.length ? (
              <DataTable
                caption="Doanh nghiệp trong nhóm hiển thị trên tổng quan"
                rows={businesses.data}
                columns={[
                  {
                    key: "name",
                    label: "Doanh nghiệp",
                    render: (b) => (
                      <PlatformIdentity
                        name={b.name}
                        subtitle={`${b.counts.vehicles} xe · ${b.counts.activeMemberships} liên kết Owner hoạt động`}
                        href={`/superadmin/businesses/${b.id}`}
                      />
                    ),
                  },
                  {
                    key: "gps",
                    label: "GPS health · TEST",
                    render: (b) => <PlatformGpsHealth gps={b.gps} compact />,
                  },
                  {
                    key: "status",
                    label: "Trạng thái",
                    render: (b) => (
                      <Badge
                        tone={b.status === "ACTIVE" ? "success" : "neutral"}
                      >
                        {b.status === "ACTIVE" ? "Hoạt động" : "Đã vô hiệu hóa"}
                      </Badge>
                    ),
                  },
                  {
                    key: "detail",
                    label: "",
                    render: (b) => (
                      <Link
                        className="platform-detail-link"
                        href={`/superadmin/businesses/${b.id}`}
                        aria-label={`Xem doanh nghiệp ${b.name}`}
                      >
                        <Icon name="chevron" size={18} />
                      </Link>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState
                title="Chưa có doanh nghiệp"
                description="Doanh nghiệp sẽ xuất hiện khi được đăng ký trên nền tảng."
                icon="business"
              />
            )
          ) : (
            <EmptyState
              title="Chưa có quyền xem danh sách doanh nghiệp"
              description="Tổng quan vẫn hiển thị theo quyền được cấp cho tài khoản."
              icon="shield"
            />
          )}
          {businesses && (
            <div className="platform-panel-foot">
              <span>
                Số liệu bao gồm doanh nghiệp đang hoạt động và đã vô hiệu hóa.
              </span>
              <Link href="/superadmin/businesses" className="link-brand">
                Tra cứu doanh nghiệp →
              </Link>
            </div>
          )}
        </Panel>
        <div className="metric-grid platform-overview-metrics">
          <MetricCard
            label="Doanh nghiệp hoạt động"
            value={data.businesses.ACTIVE.toLocaleString("vi-VN")}
            description={`${data.businesses.total} tổng · ${data.businesses.DISABLED} đã vô hiệu hóa`}
            icon="business"
            tone="brand"
          />
          <MetricCard
            label="Liên kết Owner hoạt động"
            value={data.totals.activeMemberships.toLocaleString("vi-VN")}
            description="Một người có thể liên kết nhiều doanh nghiệp"
            icon="users"
          />
          <MetricCard
            label="GPS có bản tin mới"
            value={data.gps.FRESH.toLocaleString("vi-VN")}
            description="TEST feed · Trong vòng 120 giây"
            icon="signal"
            tone="success"
          />
          <MetricCard
            label="GPS trễ / bản tin cũ"
            value={gpsAttention.toLocaleString("vi-VN")}
            description={`${data.gps.STALE} trễ · ${data.gps.OFFLINE} quá 10 phút · TEST`}
            icon="alert"
            tone={gpsAttention ? "warning" : "neutral"}
          />
        </div>
        <Panel className="platform-recent-activity">
          <PanelHeader
            title="Hoạt động nền tảng"
            subtitle={
              activity
                ? `${activity.data.length} sự kiện mới nhất / ${activity.total} trong khoảng thời gian`
                : "Nhật ký được phân quyền riêng"
            }
            icon="audit"
            action={
              activity && (
                <Link
                  className="link-brand"
                  href={`/superadmin/audit?${queryString({ from: activity.from, until: activity.until })}`}
                >
                  Xem nhật ký <Icon name="arrow" size={15} />
                </Link>
              )
            }
          />
          {activity ? (
            activity.data.length ? (
              <ol className="platform-activity-feed">
                {activity.data.map((event) => (
                  <li key={event.id}>
                    <Link
                      className="platform-activity-link"
                      href={`/superadmin/audit?${queryString({ from: activity.from, until: activity.until, action: event.action })}`}
                    >
                      <span className="platform-activity-icon">
                        <Icon
                          name={
                            event.entityType === "business"
                              ? "business"
                              : event.entityType === "user"
                                ? "users"
                                : "audit"
                          }
                          size={17}
                        />
                      </span>
                      <span className="platform-activity-copy">
                        <strong>
                          {auditLabels[event.action] ?? auditLabels.other}
                        </strong>
                        <small>
                          Tác nhân {event.actorId.slice(0, 8)}…
                          {event.entityType === "business" && event.entityId
                            ? ` · Doanh nghiệp ${event.entityId.slice(0, 8)}…`
                            : " · Nền tảng"}
                        </small>
                        <time dateTime={event.createdAt}>
                          {formatDate(event.createdAt)}
                        </time>
                      </span>
                      <Icon name="chevron" size={16} />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="Chưa có hoạt động trong khoảng thời gian"
                description="Chỉ các sự kiện được ghi nhận trong nhật ký nền tảng xuất hiện ở đây."
                icon="audit"
              />
            )
          ) : (
            <EmptyState
              title="Chưa có quyền xem nhật ký"
              description="Quyền xem hoạt động nền tảng được cấp độc lập."
              icon="shield"
            />
          )}
          {activity && (
            <div className="platform-panel-foot">
              <span>
                {formatDate(activity.from)} — {formatDate(activity.until)} · Giờ
                Việt Nam
              </span>
              <span>
                Nhật ký platform riêng, không bao gồm thao tác của Owner.
              </span>
            </div>
          )}
        </Panel>
        <div className="platform-overview-side">
          <Panel>
            <PanelHeader
              title="Cần chú ý"
              subtitle="Trạng thái hiện tại trên toàn nền tảng"
              icon="alert"
            />
            <dl className="platform-attention-list">
              <div>
                <dt>
                  <span className="platform-attention-icon">
                    <Icon name="business" size={17} />
                  </span>
                  Doanh nghiệp đã vô hiệu hóa
                </dt>
                <dd>{data.businesses.DISABLED.toLocaleString("vi-VN")}</dd>
              </div>
              <div>
                <dt>
                  <span className="platform-attention-icon is-warning">
                    <Icon name="clock" size={17} />
                  </span>
                  GPS trễ · TEST
                </dt>
                <dd>{data.gps.STALE.toLocaleString("vi-VN")}</dd>
              </div>
              <div>
                <dt>
                  <span className="platform-attention-icon is-danger">
                    <Icon name="signal" size={17} />
                  </span>
                  GPS bản tin quá 10 phút · TEST
                </dt>
                <dd>{data.gps.OFFLINE.toLocaleString("vi-VN")}</dd>
              </div>
            </dl>
            {businesses && (
              <div className="platform-panel-foot">
                <Link className="link-brand" href="/superadmin/businesses">
                  Kiểm tra theo doanh nghiệp →
                </Link>
              </div>
            )}
          </Panel>
          <Panel>
            <PanelHeader
              title="Tín hiệu GPS"
              subtitle="Bản tin gần nhất của xe đang gắn thiết bị"
              icon="signal"
              action={<Badge tone="warning">TEST feed</Badge>}
            />
            <div className="panel-body">
              <PlatformGpsHealth gps={data.gps} />
            </div>
          </Panel>
        </div>
      </div>
      <p className="platform-scope-note">
        <Icon name="shield" size={16} /> Quản trị doanh nghiệp và quyền Owner ·
        Không truy cập nghiệp vụ tenant. GPS TEST chưa xác minh thiết bị vật lý;
        không hiển thị tọa độ, thông tin khách thuê hoặc tài chính doanh nghiệp.
      </p>
    </>
  );
}
