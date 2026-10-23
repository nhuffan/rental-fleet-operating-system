"use client";
import Link from "next/link";
import { useState } from "react";
import { businesses, platformEvents } from "./fixtures";
import {
  PageHeader,
  Panel,
  PanelHeader,
  Badge,
  Button,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { DataTable, SearchInput } from "@/components/data-display/table";
import { Drawer } from "@/components/ui/drawer";
type Business = (typeof businesses)[number];
const prefix = "/dev-preview/platform";
export function PlatformPreview({
  screen = "dashboard",
  businessId,
}: {
  screen?: string;
  businessId?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [tab, setTab] = useState("overview");
  const [event, setEvent] = useState<(typeof platformEvents)[number] | null>(
    null,
  );
  const selected = businesses.find((b) => b.id === businessId);
  const title = selected
    ? selected.name
    : ({
        dashboard: "Tổng quan nền tảng",
        businesses: "Doanh nghiệp",
        users: "Người dùng nền tảng",
        features: "Quản lý tính năng",
        integrations: "Tích hợp & GPS",
        audit: "Nhật ký nền tảng",
        settings: "Cài đặt hệ thống",
      }[screen] ?? "Nền tảng");
  const filtered = businesses.filter(
    (b) =>
      `${b.name} ${b.city}`.toLowerCase().includes(query.toLowerCase()) &&
      (status === "ALL" || b.status === status),
  );
  const metrics = [
    [
      "Doanh nghiệp hoạt động",
      businesses.filter((b) => b.status === "ACTIVE").length,
      "business",
    ],
    [
      "Người dùng nền tảng",
      businesses.reduce((n, b) => n + b.users, 0),
      "users",
    ],
    ["GPS có tín hiệu*", businesses.reduce((n, b) => n + b.gps, 0), "signal"],
    [
      "GPS trễ / mất kết nối",
      businesses.reduce((n, b) => n + b.vehicles - b.gps, 0),
      "alert",
    ],
  ] as const;
  const tenantStatus = (b: Business) => (
    <Badge tone={b.status === "ACTIVE" ? "success" : "danger"}>
      {b.status === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"}
    </Badge>
  );
  const tenantColumns = [
    {
      key: "name",
      label: "Doanh nghiệp",
      render: (b: Business) => (
        <Link
          href={`${prefix}/businesses/${b.id}`}
          className="inline tenant-name"
        >
          <span className="tenant-avatar" style={{ background: b.color }}>
            {b.initials}
          </span>
          <div>
            <strong>{b.name}</strong>
            <small>{b.city}</small>
          </div>
        </Link>
      ),
    },
    {
      key: "fleet",
      label: "Xe / Users",
      render: (b: Business) => (
        <>
          {b.vehicles} xe <span className="quiet">/ {b.users} users</span>
        </>
      ),
    },
    {
      key: "gps",
      label: "GPS health*",
      render: (b: Business) => (
        <div className="health-cell">
          <span>
            {b.gps}/{b.vehicles}
          </span>
          <span className="health-bar">
            <i style={{ width: `${(b.gps / b.vehicles) * 100}%` }} />
          </span>
        </div>
      ),
    },
    { key: "status", label: "Trạng thái", render: tenantStatus },
    {
      key: "detail",
      label: "",
      render: (b: Business) => (
        <Link
          href={`${prefix}/businesses/${b.id}`}
          aria-label={`Xem doanh nghiệp ${b.name}`}
        >
          <Icon name="chevron" size={15} />
        </Link>
      ),
    },
  ];
  const tenantHealth = (
    <Panel className="tenant-health">
      <PanelHeader
        title="Sức khỏe doanh nghiệp"
        subtitle="Tổng quan trạng thái và kết nối theo tenant"
        icon="business"
        action={
          <Link className="link-brand" href={`${prefix}/businesses`}>
            Xem tất cả →
          </Link>
        }
      />
      <div className="table-toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Tìm doanh nghiệp minh họa…"
        />
        <select
          className="filter-select"
          aria-label="Lọc doanh nghiệp"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="SUSPENDED">Tạm ngưng</option>
        </select>
      </div>
      <DataTable
        rows={filtered}
        columns={tenantColumns}
        caption="Sức khỏe doanh nghiệp minh họa"
      />
    </Panel>
  );
  const activity = (
    <Panel className="platform-activity">
      <PanelHeader
        title="Hoạt động nền tảng"
        subtitle="22 tháng 10, 2026 · UTC+7 · Dữ liệu tổng hợp"
        icon="audit"
      />
      <div className="activity-feed">
        {platformEvents.map((e) => (
          <button
            className="activity-row"
            key={e.id}
            onClick={() => setEvent(e)}
          >
            <span className="activity-time">{e.time}</span>
            <span className="activity-icon">
              <Icon name={e.icon} size={16} />
            </span>
            <div>
              <strong>{e.title}</strong>
              <small>
                {e.business} · {e.description}
              </small>
            </div>
            <Icon name="chevron" size={14} />
          </button>
        ))}
      </div>
    </Panel>
  );
  let body;
  if (selected)
    body = (
      <>
        <Link className="link-brand back-link" href={`${prefix}/businesses`}>
          ← Danh sách doanh nghiệp
        </Link>
        <Panel>
          <div className="tenant-detail-hero">
            <span
              className="tenant-avatar"
              style={{ background: selected.color }}
            >
              {selected.initials}
            </span>
            <div>
              <h2>{selected.name}</h2>
              <p>
                {selected.city} · {selected.plan} (minh họa)
              </p>
            </div>
            {tenantStatus(selected)}
            <Button disabled title="Chờ platform RBAC và API">
              Tạm ngưng doanh nghiệp
            </Button>
          </div>
          <div className="detail-tabs">
            {[
              ["overview", "Tổng quan"],
              ["users", "Người dùng"],
              ["configuration", "Cấu hình"],
              ["features", "Tính năng"],
              ["integration", "Sức khỏe tích hợp"],
            ].map(([id, label]) => (
              <button
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
                key={id}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "overview" ? (
            <dl className="detail-list">
              <div>
                <dt>Đội xe</dt>
                <dd>{selected.vehicles} xe minh họa</dd>
              </div>
              <div>
                <dt>Người dùng</dt>
                <dd>{selected.users} tài khoản minh họa</dd>
              </div>
              <div>
                <dt>GPS có tín hiệu*</dt>
                <dd>
                  {selected.gps}/{selected.vehicles}
                </dd>
              </div>
              <div>
                <dt>Hoạt động cuối*</dt>
                <dd>{selected.lastActivity}</dd>
              </div>
            </dl>
          ) : tab === "users" ? (
            <div className="panel-body">
              <h3>{selected.users} người dùng trong mẫu</h3>
              <p className="quiet">
                Không có danh tính thực. Cross-tenant users API chưa được triển
                khai.
              </p>
              <Badge tone="warning">Chờ global users API</Badge>
            </div>
          ) : tab === "configuration" ? (
            <div className="panel-body">
              <label className="form-field">
                Tên doanh nghiệp
                <input value={selected.name} disabled />
              </label>
              <label className="form-field">
                Múi giờ
                <input value="Asia/Ho_Chi_Minh" disabled />
              </label>
              <Button disabled>Lưu cấu hình · Chờ API</Button>
            </div>
          ) : tab === "features" ? (
            <div className="panel-body">
              <FeatureTable business={selected.name} />
            </div>
          ) : (
            <dl className="detail-list">
              <div>
                <dt>Nhà cung cấp</dt>
                <dd>GPS Provider Demo</dd>
              </div>
              <div>
                <dt>Có tín hiệu*</dt>
                <dd>{selected.gps} thiết bị</dd>
              </div>
              <div>
                <dt>Trễ / mất kết nối*</dt>
                <dd>{selected.vehicles - selected.gps} thiết bị</dd>
              </div>
              <div>
                <dt>Thời điểm minh họa</dt>
                <dd>22/10/2026 · 10:00 UTC+7</dd>
              </div>
            </dl>
          )}
        </Panel>
      </>
    );
  else if (screen === "dashboard")
    body = (
      <div className="dashboard-grid platform-dashboard">
        {tenantHealth}
        <div className="stats-grid">
          {metrics.map(([label, value, icon], i) => (
            <Panel
              className={`compact-stat stat-${i === 3 ? "warning" : "success"}`}
              key={label}
            >
              <div className="compact-stat-title">
                <span>{label}</span>
                <Icon name={icon} size={16} />
              </div>
              <strong>{String(value).padStart(2, "0")}</strong>
              <div className="stat-bottom">
                <small>Dữ liệu minh họa*</small>
              </div>
              <div className="platform-stat-bars" aria-hidden="true">
                {[14, 22, 18, 26, 20, 29, 24, 32, 27].map((h, j) => (
                  <i key={j} style={{ height: h }} />
                ))}
              </div>
            </Panel>
          ))}
        </div>
        {activity}
        <Panel className="attention-panel">
          <PanelHeader
            title="Cần chú ý"
            subtitle="Các trường hợp minh họa cần kiểm tra"
            icon="alert"
          />
          {[
            [
              "GPS mất kết nối",
              "Sông Việt Travel",
              "12 thiết bị trong mẫu",
              "danger",
            ],
            [
              "Tín hiệu GPS trễ",
              "Bắc Nam Auto",
              "3 thiết bị trong mẫu",
              "warning",
            ],
            [
              "Doanh nghiệp tạm ngưng",
              "Sông Việt Travel",
              "Chờ kiểm tra trạng thái",
              "neutral",
            ],
          ].map(([label, b, description, tone]) => (
            <Link
              href={`${prefix}/businesses/${b === "Bắc Nam Auto" ? "bac-nam" : "song-viet"}`}
              className="attention-item"
              key={label}
            >
              <span className={`attention-dot tone-${tone}`}>
                <Icon name="alert" size={16} />
              </span>
              <div>
                <strong>{label}</strong>
                <small>
                  {b} · {description}
                </small>
              </div>
              <Icon name="chevron" size={14} />
            </Link>
          ))}
        </Panel>
      </div>
    );
  else if (screen === "businesses") body = tenantHealth;
  else if (screen === "users")
    body = (
      <Panel>
        <PanelHeader
          title="Hỗ trợ người dùng liên doanh nghiệp"
          subtitle="Danh tính tổng hợp · Chờ global users API"
          icon="users"
        />
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Tìm doanh nghiệp hoặc Owner…"
          />
          <Badge tone="warning">Preview</Badge>
        </div>
        <DataTable
          caption="Người dùng nền tảng minh họa"
          rows={businesses
            .flatMap((b) =>
              ["Owner"].map((role, i) => ({
                id: `${b.id}-${role}`,
                name: `Tài khoản mẫu ${i + 1}`,
                business: b.name,
                role,
              })),
            )
            .filter((r) =>
              `${r.business} ${r.role}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )}
          columns={[
            {
              key: "name",
              label: "Người dùng",
              render: (r) => <strong>{r.name}</strong>,
            },
            {
              key: "business",
              label: "Doanh nghiệp",
              render: (r) => r.business,
            },
            {
              key: "role",
              label: "Quyền truy cập",
              render: (r) => <Badge tone="info">{r.role}</Badge>,
            },
            {
              key: "action",
              label: "Hỗ trợ",
              render: () => <Button disabled>Chờ API</Button>,
            },
          ]}
        />
      </Panel>
    );
  else if (screen === "features")
    body = (
      <Panel>
        <PanelHeader
          title="Tính năng theo doanh nghiệp"
          subtitle="Entitlements minh họa · Chưa áp dụng lên tenant"
          icon="grid"
        />
        <div className="panel-body">
          <FeatureTable />
        </div>
      </Panel>
    );
  else if (screen === "integrations")
    body = (
      <Panel>
        <PanelHeader
          title="Tình trạng tích hợp GPS"
          subtitle="Mốc minh họa: 22/10/2026 · 10:00 UTC+7"
          icon="signal"
        />
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Tìm doanh nghiệp minh họa…"
          />
          <Badge tone="warning">Không có telemetry trực tiếp</Badge>
        </div>
        <DataTable
          rows={filtered}
          caption="Sức khỏe GPS minh họa"
          columns={[
            tenantColumns[0],
            {
              key: "provider",
              label: "Nhà cung cấp",
              render: () => "GPS Provider Demo",
            },
            {
              key: "online",
              label: "Có tín hiệu*",
              render: (b) => <Badge tone="success">{b.gps} thiết bị</Badge>,
            },
            {
              key: "offline",
              label: "Trễ / offline*",
              render: (b) => (
                <Badge tone={b.vehicles - b.gps ? "warning" : "neutral"}>
                  {b.vehicles - b.gps} thiết bị
                </Badge>
              ),
            },
            {
              key: "time",
              label: "Tại thời điểm",
              render: () => "22/10/2026 · 10:00 UTC+7",
            },
          ]}
        />
      </Panel>
    );
  else if (screen === "audit")
    body = (
      <>
        {activity}
        <div className="notice notice-info" style={{ marginTop: 16 }}>
          Global audit cần API và quyền platform riêng. GET /audit-logs hiện tại
          chỉ phục vụ tenant.
        </div>
      </>
    );
  else
    body = (
      <div className="core-grid">
        <Panel>
          <PanelHeader
            title="Cấu hình mặc định nền tảng"
            subtitle="Mẫu thiết kế · Không lưu cấu hình"
            icon="settings"
          />
          <div className="form-section">
            <label className="form-field">
              Tên nền tảng
              <input disabled value="Rental Fleet OS" />
            </label>
            <label className="form-field">
              Ngôn ngữ mặc định
              <select disabled value="vi">
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>
            <label className="form-field">
              Múi giờ mặc định
              <input disabled value="Asia/Ho_Chi_Minh" />
            </label>
            <Button disabled>Lưu cài đặt · Chờ API</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader
            title="Điều kiện kết nối production"
            subtitle="Backend epic độc lập"
            icon="shield"
          />
          <ul className="readiness-list">
            <li>Global principal và quyền platform riêng</li>
            <li>Guard server / backend cho từng endpoint</li>
            <li>Global aggregates và tenant management API</li>
            <li>Platform audit độc lập với tenant audit</li>
            <li>Kiểm thử tenant OWNER không có quyền global</li>
          </ul>
        </Panel>
      </div>
    );
  return (
    <>
      <PageHeader
        eyebrow="PLATFORM CONSOLE"
        title={title}
        description="Quản trị SaaS và sức khỏe doanh nghiệp trên nền tảng."
        action={<Badge tone="warning">Chờ platform RBAC / API</Badge>}
      />
      {body}
      {event && (
        <Drawer
          title="Chi tiết sự kiện nền tảng"
          onClose={() => setEvent(null)}
        >
          <div className="drawer-preview-note">Sự kiện tổng hợp minh họa</div>
          <div className="panel-body">
            <h2>{event.title}</h2>
            <p>{event.description}</p>
            <dl className="detail-list">
              <div>
                <dt>Doanh nghiệp</dt>
                <dd>{event.business}</dd>
              </div>
              <div>
                <dt>Thời điểm mẫu</dt>
                <dd>22/10/2026 · {event.time} UTC+7</dd>
              </div>
              <div>
                <dt>Nguồn</dt>
                <dd>Design fixtures</dd>
              </div>
            </dl>
          </div>
        </Drawer>
      )}
    </>
  );
}
function FeatureTable({ business }: { business?: string }) {
  return (
    <DataTable
      rows={[
        { id: "gps", name: "Theo dõi GPS", status: "Đã bật trong mẫu" },
        { id: "toll", name: "Phí đường bộ", status: "Chưa bật trong mẫu" },
        { id: "deposit", name: "Tiền cọc", status: "Đã bật trong mẫu" },
        {
          id: "revenue",
          name: "Tín hiệu doanh thu",
          status: "Chưa bật trong mẫu",
        },
        { id: "portal", name: "Customer Portal", status: "Chưa bật trong mẫu" },
      ]}
      caption="Entitlements minh họa"
      columns={[
        {
          key: "feature",
          label: "Tính năng",
          render: (r) => <strong>{r.name}</strong>,
        },
        {
          key: "business",
          label: "Phạm vi",
          render: () => business || "Mặc định minh họa",
        },
        {
          key: "status",
          label: "Trạng thái demo",
          render: (r) => (
            <Badge tone={r.status.startsWith("Đã") ? "success" : "neutral"}>
              {r.status}
            </Badge>
          ),
        },
        {
          key: "action",
          label: "Thay đổi",
          render: () => (
            <Button disabled title="Chờ entitlement API và global RBAC">
              Chờ API
            </Button>
          ),
        },
      ]}
    />
  );
}
