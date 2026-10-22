import Link from "next/link";
import type { Branch, Membership, Page } from "@rental-fleet/contracts";
import { api, currentContext } from "@/lib/api";
import {
  PageHeader,
  Panel,
  PanelHeader,
  Badge,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
export default async function Dashboard() {
  const c = await currentContext();
  const [branches, members] = await Promise.all([
    api<Page<Branch>>("/branches?limit=1"),
    c.permissions.includes("user.read")
      ? api<Page<Membership>>("/memberships?limit=1")
      : Promise.resolve(null),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="KHÔNG GIAN LÀM VIỆC"
        title={`Xin chào, ${c.user.displayName || "bạn"}.`}
        description="Mọi điểm vận hành, cùng một không gian quản lý."
        action={
          <Badge tone="success">
            {c.business.status === "ACTIVE"
              ? "Đang hoạt động"
              : c.business.status}
          </Badge>
        }
      />
      <div className="core-stats">
        <Panel className="core-stat">
          <span>
            <Icon name="pin" /> Chi nhánh
          </span>
          <strong>{branches.total}</strong>
        </Panel>
        {members && (
          <Panel className="core-stat">
            <span>
              <Icon name="users" /> Thành viên
            </span>
            <strong>{members.total}</strong>
          </Panel>
        )}
        <Panel className="core-stat">
          <span>
            <Icon name="shield" /> Vai trò của bạn
          </span>
          <strong style={{ fontSize: 20 }}>{c.role}</strong>
        </Panel>
      </div>
      <div className="core-grid">
        <Panel>
          <PanelHeader
            icon="business"
            title="Doanh nghiệp của bạn"
            subtitle="Thông tin không gian vận hành"
            action={
              <Link className="link-brand" href="/app/business">
                Xem hồ sơ →
              </Link>
            }
          />
          <div className="business-hero">
            <span className="context-avatar">
              <Icon name="business" size={28} />
            </span>
            <div>
              <h2>{c.business.name}</h2>
              <p>Quản lý doanh nghiệp & đội ngũ vận hành</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Múi giờ</dt>
              <dd>{c.business.timezone}</dd>
            </div>
            <div>
              <dt>Tiền tệ</dt>
              <dd>{c.business.currency}</dd>
            </div>
            <div>
              <dt>Quyền truy cập</dt>
              <dd>{c.permissions.length} quyền được cấp</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader
            icon="grid"
            title="Truy cập nhanh"
            subtitle="Các công cụ quản lý doanh nghiệp"
          />
          {[
            [
              "business",
              "business",
              "Hồ sơ doanh nghiệp",
              "Thông tin chung, múi giờ, tiền tệ",
            ],
            [
              "branches",
              "pin",
              "Quản lý chi nhánh",
              "Điểm vận hành và trạng thái",
            ],
            ...(members
              ? [
                  [
                    "users",
                    "users",
                    "Thành viên & quyền",
                    "Vai trò và quyền truy cập đội ngũ",
                  ],
                ]
              : []),
            [
              "settings",
              "settings",
              "Cài đặt chung",
              "Ngôn ngữ và định dạng ngày",
            ],
          ].map(([path, icon, title, description]) => (
            <Link className="quick-link" href={`/app/${path}`} key={path}>
              <Icon name={icon as "business" | "pin" | "users" | "settings"} />
              <div>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
              <Icon name="chevron" size={15} />
            </Link>
          ))}
        </Panel>
      </div>
      <div className="notice notice-info" style={{ marginTop: 18 }}>
        Quản lý xe, hợp đồng và GPS đang được phát triển. Tổng quan hiện hiển
        thị dữ liệu doanh nghiệp từ SaaS Core API.
      </div>
      {process.env.NODE_ENV === "development" && (
        <Link className="button button-secondary" href="/dev-preview/business">
          Xem bản thiết kế dashboard đội xe <Icon name="arrow" size={15} />
        </Link>
      )}
    </>
  );
}
