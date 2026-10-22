"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Me, Membership, Page } from "@rental-fleet/contracts";
import { useMutation, type MemberCreate } from "@/lib/api-client/use-mutation";
import {
  Button,
  Badge,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import {
  DataTable,
  SearchInput,
  Pagination,
} from "@/components/data-display/table";
import { MutationNotice } from "@/components/feedback/mutation-notice";
export function MembersPanel({
  initial,
  context,
}: {
  initial: Page<Membership>;
  context: Me;
}) {
  const router = useRouter();
  const mutation = useMutation(context.business.id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [editing, setEditing] = useState<Membership | "new" | null>(null);
  const editable = context.permissions.includes("user.manage");
  const member = editing && editing !== "new" ? editing : null;
  const rows = initial.data.filter(
    (row) =>
      `${row.displayName ?? ""} ${row.userId} ${row.roleKey}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "ALL" || row.status === status),
  );
  const columns = [
    {
      key: "name",
      label: "Thành viên",
      render: (r: Membership) => (
        <div className="inline">
          <span className="avatar">
            {(r.displayName || "ND").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{r.displayName || "Chưa có tên hiển thị"}</strong>
            <small>
              <code>{r.userId}</code>
            </small>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Vai trò",
      render: (r: Membership) => (
        <Badge
          tone={
            r.roleKey === "OWNER"
              ? "brand"
              : r.roleKey === "ADMIN"
                ? "info"
                : "neutral"
          }
        >
          {r.roleKey}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      render: (r: Membership) => <StatusBadge status={r.status} />,
    },
    ...(editable
      ? [
          {
            key: "action",
            label: "Thao tác",
            render: (r: Membership) =>
              context.role === "OWNER" || r.roleKey === "OPERATIONS" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    mutation.clear();
                    setEditing(r);
                  }}
                >
                  Chỉnh sửa
                </Button>
              ) : (
                <span className="quiet">Chỉ Owner quản lý</span>
              ),
          },
        ]
      : []),
  ];
  return (
    <>
      <MutationNotice {...mutation} />
      <Panel>
        <PanelHeader
          title="Thành viên doanh nghiệp"
          subtitle={`${initial.total} thành viên · Quyền truy cập theo vai trò`}
          icon="users"
          action={
            editable && (
              <Button
                onClick={() => {
                  mutation.clear();
                  setEditing("new");
                }}
              >
                <Icon name="plus" size={15} />
                Thêm thành viên
              </Button>
            )
          }
        />
        <div className="table-toolbar">
          <SearchInput value={query} onChange={setQuery} />
          <select
            className="filter-select"
            aria-label="Lọc trạng thái thành viên"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="DISABLED">Đã vô hiệu hóa</option>
          </select>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          caption="Danh sách thành viên của doanh nghiệp hiện tại"
        />
        <Pagination
          {...initial}
          onPage={(p) => router.push(`/app/users?page=${p}`)}
        />
      </Panel>
      <p className="quiet" style={{ marginTop: 14 }}>
        Tìm kiếm và bộ lọc áp dụng cho trang hiện tại. Chỉ Owner được quản lý
        vai trò Owner / Admin.
      </p>
      {editing && (
        <Drawer
          title={member ? "Chỉnh sửa thành viên" : "Thêm thành viên"}
          onClose={() => {
            if (!mutation.busy) setEditing(null);
          }}
        >
          <div className="panel-body">
            <MutationNotice {...mutation} />
            <p className="quiet">
              {member
                ? "Cập nhật vai trò và trạng thái trong doanh nghiệp này."
                : "Nhập User ID của tài khoản đã được tạo trong Supabase Auth. Thao tác này không gửi thư mời email."}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const roleKey = f.get("roleKey") as MemberCreate["roleKey"];
                const ok = member
                  ? await mutation.mutate({
                      path: `/memberships/${member.id}`,
                      body: {
                        roleKey,
                        status: f.get("status") as "ACTIVE" | "DISABLED",
                      },
                    })
                  : await mutation.mutate({
                      path: "/memberships",
                      method: "POST",
                      body: { userId: String(f.get("userId")).trim(), roleKey },
                    });
                if (ok) setEditing(null);
              }}
            >
              <fieldset disabled={mutation.busy}>
                {!member && (
                  <label className="form-field">
                    Supabase Auth User ID
                    <input
                      name="userId"
                      required
                      pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      autoFocus
                    />
                  </label>
                )}
                <label className="form-field">
                  Vai trò
                  <select
                    name="roleKey"
                    defaultValue={member?.roleKey ?? "OPERATIONS"}
                  >
                    {(context.role === "OWNER"
                      ? ["OWNER", "ADMIN", "OPERATIONS"]
                      : ["OPERATIONS"]
                    ).map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </label>
                {member && (
                  <label className="form-field">
                    Trạng thái
                    <select name="status" defaultValue={member.status}>
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="DISABLED">Vô hiệu hóa</option>
                    </select>
                  </label>
                )}
                <div className="inline">
                  <Button type="submit" disabled={mutation.busy}>
                    {mutation.busy ? "Đang lưu…" : "Lưu thành viên"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditing(null)}
                  >
                    Hủy
                  </Button>
                </div>
              </fieldset>
            </form>
          </div>
        </Drawer>
      )}
    </>
  );
}
