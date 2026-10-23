"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Panel,
  PanelHeader,
  Input,
  Select,
  FormField,
  StatusBadge,
  Badge,
  Notice,
} from "@/components/ui/primitives";
import { DataTable, Pagination } from "@/components/data-display/table";
import { formatDate, queryString } from "@/lib/query";
import { auditLabels } from "./query";
import type {
  PlatformAuditPage,
  PlatformUserPage,
  PlatformUserDetail,
} from "./types";
type Filters = Record<string, string | number>;
const statuses = (
  <>
    <option value="">Mọi trạng thái</option>
    <option value="ACTIVE">Hoạt động</option>
    <option value="DISABLED">Đã vô hiệu hóa</option>
  </>
);
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
      router.push(`/superadmin/${mode}?${queryString(values)}`),
    );
  return (
    <Panel>
      <PanelHeader
        title={mode === "audit" ? "Nhật ký nền tảng" : "Tra cứu người dùng"}
        icon={mode === "audit" ? "audit" : "users"}
        subtitle={`${data.total} ${mode === "audit" ? "sự kiện phù hợp" : "hồ sơ duy nhất phù hợp"} · LIVE · Chỉ đọc`}
      />
      <form
        className="platform-support-filters panel-body"
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
            <FormField id="support-search" label="Tên hiển thị">
              <Input
                id="support-search"
                type="search"
                name="search"
                maxLength={120}
                defaultValue={filters.search}
              />
            </FormField>
            <FormField id="support-status" label="Trạng thái hồ sơ">
              <Select
                id="support-status"
                name="status"
                defaultValue={filters.status}
              >
                {statuses}
              </Select>
            </FormField>
            <FormField
              id="support-membership"
              label="Trạng thái truy cập doanh nghiệp"
            >
              <Select
                id="support-membership"
                name="membershipStatus"
                defaultValue={filters.membershipStatus}
              >
                {statuses}
              </Select>
            </FormField>
          </>
        ) : (
          <>
            <FormField id="support-action" label="Hành động">
              <Select
                id="support-action"
                name="action"
                defaultValue={filters.action}
              >
                <option value="">Mọi hành động</option>
                {Object.entries(auditLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            {(["from", "until"] as const).map((key) => (
              <FormField
                key={key}
                id={`support-${key}`}
                label={
                  key === "from" ? "Từ (UTC, bao gồm)" : "Đến (UTC, không gồm)"
                }
              >
                <Input
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
        <FormField id="support-sort" label="Sắp xếp">
          <Select id="support-sort" name="sort" defaultValue={filters.sort}>
            <option value="createdAt">Thời gian tạo</option>
            <option value={mode === "audit" ? "action" : "name"}>
              {mode === "audit" ? "Hành động" : "Tên hiển thị"}
            </option>
          </Select>
        </FormField>
        <FormField id="support-order" label="Chiều">
          <Select id="support-order" name="order" defaultValue={filters.order}>
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </Select>
        </FormField>
        <FormField id="support-limit" label="Mỗi trang">
          <Select id="support-limit" name="limit" defaultValue={filters.limit}>
            {[20, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </FormField>
        <Button type="submit" variant="secondary" loading={pending}>
          {pending ? "Đang tải…" : "Áp dụng"}
        </Button>
        <Link className="button button-ghost" href={`/superadmin/${mode}`}>
          Xóa bộ lọc
        </Link>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
      <div aria-busy={pending}>
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
                    {auditLabels[a.action] ?? auditLabels.other}
                    <small>{a.action}</small>
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
                    <code>{a.actorId}</code>
                  </Link>
                ),
              },
              {
                key: "entity",
                label: "Đích",
                render: (a) => (
                  <>
                    {a.entityType}
                    {a.entityId && (
                      <small>
                        {a.entityType === "business" ||
                        a.entityType === "user" ? (
                          <Link
                            className="link-brand"
                            href={`/superadmin/${a.entityType === "business" ? "businesses" : "users"}/${a.entityId}`}
                          >
                            <code>{a.entityId}</code>
                          </Link>
                        ) : (
                          <code>{a.entityId}</code>
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
                  <code>{a.requestId ?? "Không có mã hợp lệ"}</code>
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
                  <Link
                    className="fleet-record-link"
                    href={`/superadmin/users/${u.id}`}
                  >
                    <strong>{u.displayName}</strong>
                    <small>
                      <code>{u.id}</code>
                    </small>
                  </Link>
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
        <PanelHeader
          title={u.displayName}
          icon="users"
          action={<StatusBadge status={u.status} />}
        />
        <dl className="detail-list">
          <div>
            <dt>Mã hồ sơ</dt>
            <dd>
              <code>{u.id}</code>
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
      <Panel className="platform-live-detail">
        <PanelHeader
          title="Liên kết doanh nghiệp"
          icon="business"
          subtitle="Trạng thái truy cập Owner và doanh nghiệp được hiển thị riêng."
        />
        <div aria-busy={pending}>
          <DataTable
            caption="Quyền Owner của hồ sơ, có phân trang từ API"
            rows={data.memberships.data}
            columns={[
              {
                key: "business",
                label: "Doanh nghiệp",
                render: (m) => (
                  <Link
                    className="link-brand"
                    href={`/superadmin/businesses/${m.businessId}`}
                  >
                    {m.businessName}
                    <small>
                      <code>{m.businessId}</code>
                    </small>
                  </Link>
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
                ),
              )
            }
          />
        </div>
      </Panel>
    </>
  );
}
