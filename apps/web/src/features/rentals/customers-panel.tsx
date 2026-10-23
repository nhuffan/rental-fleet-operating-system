"use client";
import Link from "next/link";
import { Combobox, FilterBar, SearchField } from "@/components/ui/controls";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import {
  Button,
  Panel,
  PanelHeader,
  RefreshStatus,
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
    startTransition(() =>
      router.push(`/app/customers?${queryString(values)}`, { scroll: false }),
    );
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
        <FilterBar
          key={JSON.stringify(filters)}
          busy={pending}
          aria-label="Bộ lọc khách hàng"
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
          <SearchField
            type="search"
            name="search"
            label="Tìm khách hàng"
            placeholder="Tên, điện thoại hoặc email…"
            maxLength={100}
            defaultValue={filters.search}
          />
          <Combobox
            name="status"
            label="Trạng thái khách hàng"
            defaultValue={filters.status}
            options={[
              { value: "", label: "Mọi trạng thái" },
              { value: "ACTIVE", label: "Hoạt động" },
              { value: "INACTIVE", label: "Ngưng hoạt động" },
            ]}
          />
          <Combobox
            name="sort"
            label="Sắp xếp khách hàng"
            defaultValue={filters.sort}
            options={[
              { value: "createdAt", label: "Ngày tạo" },
              { value: "name", label: "Tên khách hàng" },
            ]}
          />
          <div className="filter-bar-actions">
            <Button type="submit" variant="secondary" loading={pending}>
              Áp dụng
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={pending}
              onClick={(event) => {
                event.currentTarget.form?.reset();
                navigate({ page: 1 });
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </FilterBar>
        <div className="pending-region" aria-busy={pending}>
          <RefreshStatus pending={pending} />
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
            disabled={pending}
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
