"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import {
  Button,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { DataTable, Pagination } from "@/components/data-display/table";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { queryString } from "@/lib/query";
import { CustomerEditor } from "./customer-editor";
import type { Customer, CustomerPage } from "./types";
import type { CustomerFilters } from "./query";
export function CustomersPanel({
  initial,
  context,
  filters,
}: {
  initial: CustomerPage;
  context: Me;
  filters: CustomerFilters;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const canEdit = context.permissions.includes("customer.manage");
  function navigate(values: Record<string, string | number>) {
    startTransition(() => router.push(`/app/customers?${queryString(values)}`));
  }
  return (
    <>
      <MutationNotice error="" message={message} />
      <Panel>
        <PanelHeader
          title="Danh sách khách hàng"
          subtitle={`${initial.total} khách hàng phù hợp bộ lọc`}
          icon="users"
          action={
            canEdit && (
              <Button onClick={() => setEditing("new")}>Thêm khách hàng</Button>
            )
          }
        />
        <form
          className="table-toolbar fleet-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            navigate({
              ...filters,
              search: String(form.get("search")).trim(),
              status: String(form.get("status")),
              sort: String(form.get("sort")),
              page: 1,
            });
          }}
        >
          <label className="search-input">
            <input
              type="search"
              name="search"
              aria-label="Tìm khách hàng"
              placeholder="Tên, điện thoại hoặc email…"
              maxLength={100}
              defaultValue={filters.search}
            />
          </label>
          <select
            className="filter-select"
            name="status"
            aria-label="Trạng thái khách hàng"
            defaultValue={filters.status}
          >
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Ngưng hoạt động</option>
          </select>
          <select
            className="filter-select"
            name="sort"
            aria-label="Sắp xếp khách hàng"
            defaultValue={filters.sort}
          >
            <option value="createdAt">Ngày tạo</option>
            <option value="name">Tên khách hàng</option>
          </select>
          <Button type="submit" variant="secondary" disabled={pending}>
            Áp dụng
          </Button>
        </form>
        <div aria-busy={pending}>
          <DataTable
            caption="Khách hàng của doanh nghiệp"
            rows={initial.data}
            columns={[
              {
                key: "name",
                label: "Khách hàng",
                render: (customer) => (
                  <Link
                    className="fleet-record-link"
                    href={`/app/customers/${customer.id}`}
                  >
                    <strong>{customer.name}</strong>
                  </Link>
                ),
              },
              {
                key: "phone",
                label: "Điện thoại",
                render: (customer) => customer.phone || "—",
              },
              {
                key: "email",
                label: "Email",
                render: (customer) => customer.email || "—",
              },
              {
                key: "status",
                label: "Trạng thái",
                render: (customer) => <StatusBadge status={customer.status} />,
              },
              {
                key: "actions",
                label: "Thao tác",
                render: (customer) => (
                  <div className="inline">
                    <Link
                      className="button button-secondary"
                      href={`/app/customers/${customer.id}`}
                    >
                      Chi tiết
                    </Link>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        onClick={() => setEditing(customer)}
                      >
                        Chỉnh sửa
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            {...initial}
            onPage={(page) => navigate({ ...filters, page })}
          />
        </div>
      </Panel>
      {editing && (
        <CustomerEditor
          businessId={context.business.id}
          customer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setMessage("Đã lưu thông tin khách hàng.")}
        />
      )}
    </>
  );
}
