"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Branch, Me, Page } from "@rental-fleet/contracts";
import { useMutation } from "@/lib/api-client/use-mutation";
import {
  Button,
  Input,
  Select,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { Icon } from "@/components/ui/icon";
import {
  DataTable,
  SearchInput,
  Pagination,
} from "@/components/data-display/table";
import { MutationNotice } from "@/components/feedback/mutation-notice";
export function BranchesPanel({
  initial,
  context,
}: {
  initial: Page<Branch>;
  context: Me;
}) {
  const router = useRouter();
  const mutation = useMutation(context.business.id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const branch = editing && editing !== "new" ? editing : null;
  const editable = context.permissions.includes("branch.manage");
  const rows = initial.data.filter(
    (r) =>
      `${r.name} ${r.address}`.toLowerCase().includes(query.toLowerCase()) &&
      (status === "ALL" || status === r.status),
  );
  return (
    <>
      <MutationNotice {...mutation} />
      <Panel>
        <PanelHeader
          title="Điểm vận hành"
          subtitle={`${initial.total} chi nhánh trong doanh nghiệp`}
          icon="pin"
          action={
            editable && (
              <Button
                onClick={() => {
                  mutation.clear();
                  setEditing("new");
                }}
              >
                <Icon name="plus" size={15} />
                Thêm chi nhánh
              </Button>
            )
          }
        />
        <div className="table-toolbar">
          <SearchInput value={query} onChange={setQuery} />
          <Select
            className="filter-select"
            aria-label="Lọc trạng thái chi nhánh"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="DISABLED">Đã vô hiệu hóa</option>
          </Select>
        </div>
        <DataTable
          rows={rows}
          caption="Danh sách chi nhánh"
          columns={[
            {
              key: "name",
              label: "Chi nhánh",
              render: (r) => <strong>{r.name}</strong>,
            },
            {
              key: "address",
              label: "Địa chỉ",
              render: (r) => r.address || "Chưa cập nhật",
            },
            {
              key: "status",
              label: "Trạng thái",
              render: (r) => <StatusBadge status={r.status} />,
            },
            ...(editable
              ? [
                  {
                    key: "action",
                    label: "Thao tác",
                    render: (r: Branch) => (
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
          ]}
        />
        <Pagination
          {...initial}
          onPage={(p) => router.push(`/app/branches?page=${p}`)}
        />
      </Panel>
      <p className="quiet" style={{ marginTop: 14 }}>
        Tìm kiếm và bộ lọc áp dụng cho trang hiện tại.
      </p>
      {editing && (
        <FormDialog
          busy={mutation.busy}
          footer={
            <DialogActions
              formId="branch-form"
              busy={mutation.busy}
              onCancel={() => setEditing(null)}
              submitLabel="Lưu chi nhánh"
            />
          }
          title={branch ? "Chỉnh sửa chi nhánh" : "Thêm chi nhánh"}
          onClose={() => {
            if (!mutation.busy) setEditing(null);
          }}
        >
          <div>
            <MutationNotice {...mutation} />
            <form
              id="branch-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const body = {
                  name: String(f.get("name")).trim(),
                  address: String(f.get("address")).trim(),
                };
                const ok = branch
                  ? await mutation.mutate({
                      path: `/branches/${branch.id}`,
                      body: {
                        ...body,
                        status: f.get("status") as "ACTIVE" | "DISABLED",
                      },
                    })
                  : await mutation.mutate({
                      path: "/branches",
                      method: "POST",
                      body,
                    });
                if (ok) setEditing(null);
              }}
            >
              <fieldset disabled={mutation.busy}>
                <label className="form-field">
                  Tên chi nhánh
                  <Input
                    name="name"
                    defaultValue={branch?.name ?? ""}
                    required
                    maxLength={120}
                    pattern=".*\S.*"
                    autoFocus
                  />
                </label>
                <label className="form-field">
                  Địa chỉ
                  <Input
                    name="address"
                    defaultValue={branch?.address ?? ""}
                    maxLength={500}
                  />
                </label>
                {branch && (
                  <label className="form-field">
                    Trạng thái
                    <Select name="status" defaultValue={branch.status}>
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="DISABLED">Vô hiệu hóa</option>
                    </Select>
                  </label>
                )}
              </fieldset>
            </form>
          </div>
        </FormDialog>
      )}
    </>
  );
}
