"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Me, Membership, Page } from "@rental-fleet/contracts";
import { useMutation } from "@/lib/api-client/use-mutation";
import {
  Button,
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
      `${row.displayName ?? ""} ${row.userId}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "ALL" || row.status === status),
  );
  const columns = [
    {
      key: "name",
      label: "Owner",
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
      key: "status",
      label: "Trạng thái",
      render: (r: Membership) => <StatusBadge status={r.status} />,
    },
    ...(editable
      ? [
          {
            key: "action",
            label: "Thao tác",
            render: (r: Membership) => (
              <Button
                variant="secondary"
                onClick={() => {
                  mutation.clear();
                  setEditing(r);
                }}
              >
                Chỉnh sửa
              </Button>
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
          title="Owner của doanh nghiệp"
          subtitle={`${initial.total} Owner · Toàn quyền quản lý doanh nghiệp`}
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
                Thêm Owner
              </Button>
            )
          }
        />
        <div className="table-toolbar">
          <SearchInput value={query} onChange={setQuery} />
          <select
            className="filter-select"
            aria-label="Lọc trạng thái Owner"
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
          caption="Danh sách Owner của doanh nghiệp hiện tại"
        />
        <Pagination
          {...initial}
          onPage={(p) => router.push(`/app/users?page=${p}`)}
        />
      </Panel>
      <p className="quiet" style={{ marginTop: 14 }}>
        Tìm kiếm và bộ lọc áp dụng cho trang hiện tại. Mỗi Owner có toàn quyền
        quản lý doanh nghiệp. Luôn giữ ít nhất một Owner hoạt động.
      </p>
      {editing && (
        <Drawer
          title={member ? "Cập nhật quyền truy cập Owner" : "Thêm Owner"}
          onClose={() => {
            if (!mutation.busy) setEditing(null);
          }}
        >
          <div className="panel-body">
            <MutationNotice {...mutation} />
            <p className="quiet">
              {member
                ? "Bật hoặc tắt quyền truy cập Owner trong doanh nghiệp này."
                : "Nhập User ID của tài khoản đã được tạo trong Supabase Auth để cấp toàn quyền Owner. Thao tác này không gửi thư mời email."}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const ok = member
                  ? await mutation.mutate({
                      path: `/memberships/${member.id}`,
                      body: {
                        status: f.get("status") as "ACTIVE" | "DISABLED",
                      },
                    })
                  : await mutation.mutate({
                      path: "/memberships",
                      method: "POST",
                      body: { userId: String(f.get("userId")).trim() },
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
                    {mutation.busy ? "Đang lưu…" : "Lưu quyền truy cập"}
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
