"use client";
import Link from "next/link";
import {
  Combobox,
  DateInput,
  FilterBar,
  SearchField,
} from "@/components/ui/controls";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Panel,
  PanelHeader,
  RefreshStatus,
  Input,
  FormField,
  StatusBadge,
  Badge,
  Notice,
} from "@/components/ui/primitives";
import { DataTable, Pagination } from "@/components/data-display/table";
import { formatDate, queryString } from "@/lib/query";
import { auditLabels } from "./query";
import { PlatformIdentity } from "./presentation";
import { Icon } from "@/components/ui/icon";
import type {
  PlatformAuditPage,
  PlatformUserPage,
  PlatformUserDetail,
} from "./types";
type Filters = Record<string, string | number>;
const statuses = [
  { value: "", label: "Mọi trạng thái" },
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "DISABLED", label: "Đã vô hiệu hóa" },
];
export function SupportPanel({
  mode,
  data,
  filters,
}:
  | { mode: "audit"; data: PlatformAuditPage; filters: Filters }
  | { mode: "users"; data: PlatformUserPage; filters: Filters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const go = (values: Filters) =>
    startTransition(() =>
      router.push(`/superadmin/${mode}?${queryString(values)}`, {
        scroll: false,
      }),
    );
  return (
    <Panel className="platform-list-panel">
      <PanelHeader
        title={mode === "audit" ? "Nhật ký nền tảng" : "Tra cứu người dùng"}
        icon={mode === "audit" ? "audit" : "users"}
        subtitle={`${data.total} ${mode === "audit" ? "sự kiện phù hợp" : "hồ sơ duy nhất phù hợp"} · Trang ${data.page} · Chỉ đọc`}
        action={
          <span className="platform-result-count">
            {data.data.length} hiển thị
          </span>
        }
      />
      <FilterBar
        key={`${mode}-${JSON.stringify(filters)}`}
        busy={pending}
        className="platform-support-filters"
        aria-label={
          mode === "audit" ? "Lọc nhật ký nền tảng" : "Lọc người dùng"
        }
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const form = new FormData(event.currentTarget);
          const values: Filters = { ...filters, page: 1 };
          for (const [key, value] of form.entries())
            values[key] = String(value).trim();
          if (mode === "audit") {
            for (const key of ["from", "until"])
              values[key] = values[key]
                ? new Date(`${values[key]}Z`).toISOString()
                : "";
            const span =
              Date.parse(String(values.until)) -
              Date.parse(String(values.from));
            if (!(span > 0 && span <= 366 * 86400000)) {
              setError("Khoảng thời gian phải tăng dần và không quá 366 ngày.");
              return;
            }
          }
          go(values);
        }}
      >
        {mode === "users" ? (
          <>
            <SearchField
              id="support-search"
              label="Tên hiển thị"
              name="search"
              maxLength={120}
              defaultValue={filters.search}
              placeholder="Tìm tên người dùng…"
            />
            <Combobox
              id="support-status"
              label="Trạng thái hồ sơ"
              name="status"
              defaultValue={filters.status}
              options={statuses}
            />
            <Combobox
              id="support-membership"
              label="Trạng thái truy cập doanh nghiệp"
              name="membershipStatus"
              defaultValue={filters.membershipStatus}
              options={statuses}
            />
          </>
        ) : (
          <>
            <Combobox
              id="support-action"
              label="Hành động"
              name="action"
              defaultValue={filters.action}
              options={[
                { value: "", label: "Mọi hành động" },
                ...Object.entries(auditLabels).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              searchable
            />
            {(["from", "until"] as const).map((key) => (
              <FormField
                key={key}
                id={`support-${key}`}
                label={
                  key === "from" ? "Từ (UTC, bao gồm)" : "Đến (UTC, không gồm)"
                }
              >
                <DateInput
                  id={`support-${key}`}
                  type="datetime-local"
                  name={key}
                  required
                  defaultValue={String(filters[key]).slice(0, 16)}
                />
              </FormField>
            ))}
          </>
        )}
        <FormField
          id="support-business"
          label={mode === "audit" ? "Mã doanh nghiệp đích" : "Mã doanh nghiệp"}
        >
          <Input
            id="support-business"
            name="businessId"
            defaultValue={filters.businessId}
            placeholder="UUID doanh nghiệp"
            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
          />
        </FormField>
        <Combobox
          id="support-sort"
          label="Sắp xếp"
          name="sort"
          defaultValue={filters.sort}
          options={[
            { value: "createdAt", label: "Thời gian tạo" },
            {
              value: mode === "audit" ? "action" : "name",
              label: mode === "audit" ? "Hành động" : "Tên hiển thị",
            },
          ]}
        />
        <Combobox
          id="support-order"
          label="Chiều sắp xếp"
          name="order"
          defaultValue={filters.order}
          options={[
            { value: "desc", label: "Giảm dần" },
            { value: "asc", label: "Tăng dần" },
          ]}
        />
        <Combobox
          id="support-limit"
          label="Mỗi trang"
          name="limit"
          defaultValue={filters.limit}
          options={[20, 50, 100].map((value) => ({
            value: String(value),
            label: `${value} / trang`,
          }))}
        />
        <div className="filter-bar-actions">
          <Button type="submit" variant="secondary" loading={pending}>
            {pending ? "Đang tải…" : "Áp dụng"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={pending}
            onClick={(event) => {
              event.currentTarget.form?.reset();
              setError("");
              go({});
            }}
          >
            Xóa bộ lọc
          </Button>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </FilterBar>
      <div className="pending-region" aria-busy={pending}>
        <RefreshStatus pending={pending} />
        {mode === "audit" ? (
          <DataTable
            caption="Sự kiện platform, độc lập với nhật ký doanh nghiệp"
            rows={data.data}
            columns={[
              {
                key: "created",
                label: "Thời gian (VN)",
                render: (a) => formatDate(a.createdAt),
              },
              {
                key: "action",
                label: "Hành động",
                render: (a) => (
                  <>
                    <span className="platform-audit-action">
                      <span className="platform-activity-icon">
                        <Icon name="audit" size={16} />
                      </span>
                      <strong>
                        {auditLabels[a.action] ?? auditLabels.other}
                      </strong>
                    </span>
                    <small className="platform-raw-action">{a.action}</small>
                  </>
                ),
              },
              {
                key: "actor",
                label: "Tác nhân",
                render: (a) => (
                  <Link
                    className="link-brand"
                    href={`/superadmin/users/${a.actorId}`}
                  >
                    <code className="platform-reference">{a.actorId}</code>
                  </Link>
                ),
              },
              {
                key: "entity",
                label: "Đích",
                render: (a) => (
                  <>
                    <Badge
                      tone={a.entityType === "business" ? "brand" : "neutral"}
                    >
                      {
                        {
                          platform: "Nền tảng",
                          business: "Doanh nghiệp",
                          user: "Người dùng",
                          platform_membership: "Quyền platform",
                          other: "Khác",
                        }[a.entityType]
                      }
                    </Badge>
                    {a.entityId && (
                      <small>
                        {a.entityType === "business" ||
                        a.entityType === "user" ? (
                          <Link
                            className="link-brand"
                            href={`/superadmin/${a.entityType === "business" ? "businesses" : "users"}/${a.entityId}`}
                          >
                            <code className="platform-reference">
                              {a.entityId}
                            </code>
                          </Link>
                        ) : (
                          <code className="platform-reference">
                            {a.entityId}
                          </code>
                        )}
                      </small>
                    )}
                  </>
                ),
              },
              {
                key: "request",
                label: "Request ID",
                render: (a) => (
                  <code className="platform-reference">
                    {a.requestId ?? "Không có mã hợp lệ"}
                  </code>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            caption="Mỗi dòng là một hồ sơ người dùng duy nhất"
            rows={data.data}
            columns={[
              {
                key: "name",
                label: "Người dùng",
                render: (u) => (
                  <PlatformIdentity
                    kind="users"
                    name={u.displayName}
                    subtitle={u.id}
                    href={`/superadmin/users/${u.id}`}
                  />
                ),
              },
              {
                key: "status",
                label: "Hồ sơ",
                render: (u) => <StatusBadge status={u.status} />,
              },
              {
                key: "platform",
                label: "Quyền Superadmin",
                render: (u) =>
                  u.platformStatus === "NONE" ? (
                    <Badge>Chưa cấp</Badge>
                  ) : (
                    <Badge
                      tone={
                        u.platformStatus === "ACTIVE" && u.status === "ACTIVE"
                          ? "brand"
                          : "neutral"
                      }
                    >
                      {u.platformStatus === "ACTIVE" && u.status === "ACTIVE"
                        ? "Superadmin"
                        : "Superadmin · Đã vô hiệu hóa"}
                    </Badge>
                  ),
              },
              {
                key: "memberships",
                label: "Doanh nghiệp",
                render: (u) => (
                  <>
                    {u.activeMembershipCount} / {u.membershipCount}
                    <small>hiệu lực / tổng</small>
                  </>
                ),
              },
              {
                key: "roles",
                label: "Quyền doanh nghiệp",
                render: (u) =>
                  u.roles.includes("OWNER")
                    ? u.activeMembershipCount > 0
                      ? "Owner"
                      : "Owner · Không hiệu lực"
                    : "Chưa cấp",
              },
              {
                key: "created",
                label: "Tạo lúc (VN)",
                render: (u) => formatDate(u.createdAt),
              },
              {
                key: "detail",
                label: "",
                render: (u) => (
                  <Link
                    className="platform-detail-link"
                    aria-label={`Xem người dùng ${u.displayName}`}
                    href={`/superadmin/users/${u.id}`}
                  >
                    <Icon name="chevron" size={18} />
                  </Link>
                ),
              },
            ]}
          />
        )}
        <Pagination
          disabled={pending}
          {...data}
          onPage={(page) => go({ ...filters, page })}
        />
      </div>
      <div className="panel-body">
        <Notice>
          {mode === "audit"
            ? "Chỉ nhật ký platform; bộ lọc doanh nghiệp chỉ áp dụng cho sự kiện nhắm trực tiếp đến doanh nghiệp đó. Các trường ngoài danh sách cho phép được lược bỏ."
            : "Tổng là số hồ sơ duy nhất. Quyền doanh nghiệp hiệu lực cần hồ sơ, Owner và doanh nghiệp cùng hoạt động. Hồ sơ chưa được cấp quyền không có quyền Owner hoặc Superadmin; cổng khách thuê xe chưa được triển khai. Không cung cấp email hoặc thông tin liên hệ."}
        </Notice>
      </div>
    </Panel>
  );
}
export function UserDetailPanel({ data }: { data: PlatformUserDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const u = data.profile;
  return (
    <>
      <Panel>
        <div className="tenant-detail-hero platform-user-hero">
          <PlatformIdentity
            kind="users"
            name={u.displayName}
            subtitle="Hồ sơ ứng dụng · Hỗ trợ chỉ đọc"
          />
          <StatusBadge status={u.status} />
          <Badge tone="info">Chỉ đọc</Badge>
        </div>
      </Panel>
      <div className="platform-user-detail-grid">
        <Panel>
          <PanelHeader title="Thông tin hồ sơ" icon="users" />
          <dl className="detail-list">
            <div>
              <dt>Mã hồ sơ</dt>
              <dd>
                <code className="platform-reference">{u.id}</code>
              </dd>
            </div>
            <div>
              <dt>Quyền Superadmin</dt>
              <dd>
                {u.platformStatus === "NONE"
                  ? "Chưa cấp"
                  : u.platformStatus === "ACTIVE" && u.status === "ACTIVE"
                    ? "Superadmin"
                    : "Superadmin · Đã vô hiệu hóa"}
              </dd>
            </div>
            <div>
              <dt>Doanh nghiệp hiệu lực / tổng</dt>
              <dd>
                {u.activeMembershipCount} / {u.membershipCount}
              </dd>
            </div>
            <div>
              <dt>Tạo lúc (VN)</dt>
              <dd>{formatDate(u.createdAt)}</dd>
            </div>
            <div>
              <dt>Cập nhật (VN)</dt>
              <dd>{formatDate(u.updatedAt)}</dd>
            </div>
          </dl>
          <div className="panel-body">
            <Notice>
              Chỉ tra cứu hỗ trợ. Mạo danh, đặt lại mật khẩu, vô hiệu hóa tài
              khoản và đổi quyền chưa khả dụng.
            </Notice>
          </div>
        </Panel>
        <Panel className="platform-list-panel">
          <PanelHeader
            title="Liên kết doanh nghiệp"
            icon="business"
            subtitle="Trạng thái truy cập Owner và doanh nghiệp được hiển thị riêng."
          />
          <div className="pending-region" aria-busy={pending}>
            <RefreshStatus pending={pending} />
            <DataTable
              caption="Quyền Owner của hồ sơ, có phân trang từ API"
              rows={data.memberships.data}
              columns={[
                {
                  key: "business",
                  label: "Doanh nghiệp",
                  render: (m) => (
                    <PlatformIdentity
                      name={m.businessName}
                      subtitle={m.businessId}
                      href={`/superadmin/businesses/${m.businessId}`}
                    />
                  ),
                },
                {
                  key: "status",
                  label: "Quyền Owner",
                  render: (m) => <StatusBadge status={m.status} />,
                },
                {
                  key: "businessStatus",
                  label: "Doanh nghiệp",
                  render: (m) => <StatusBadge status={m.businessStatus} />,
                },
              ]}
            />
            <Pagination
              disabled={pending}
              {...data.memberships}
              onPage={(page) =>
                startTransition(() =>
                  router.push(
                    `/superadmin/users/${u.id}?${queryString({ page, limit: data.memberships.limit })}`,
                    { scroll: false },
                  ),
                )
              }
            />
          </div>
        </Panel>
      </div>
    </>
  );
}
