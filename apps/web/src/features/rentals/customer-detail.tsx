"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import {
  Button,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { Pagination } from "@/components/data-display/table";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { formatDate } from "@/lib/query";
import { CustomerEditor } from "./customer-editor";
import { RentalTable } from "./rental-table";
import type { Customer, RentalPage } from "./types";
export function CustomerDetail({
  customer,
  rentals,
  context,
}: {
  customer: Customer;
  rentals: RentalPage | null;
  context: Me;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <MutationNotice error="" message={message} />
      <Panel>
        <PanelHeader
          title="Thông tin khách hàng"
          icon="users"
          action={
            context.permissions.includes("customer.manage") && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Chỉnh sửa khách hàng
              </Button>
            )
          }
        />
        <dl className="detail-list">
          <div>
            <dt>Tên</dt>
            <dd>{customer.name}</dd>
          </div>
          <div>
            <dt>Điện thoại</dt>
            <dd>{customer.phone || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{customer.email || "—"}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <StatusBadge status={customer.status} />
            </dd>
          </div>
          <div>
            <dt>Ngày tạo</dt>
            <dd>{formatDate(customer.createdAt)}</dd>
          </div>
          <div>
            <dt>Ghi chú</dt>
            <dd className="rental-notes">
              {customer.notes || "Chưa có ghi chú"}
            </dd>
          </div>
        </dl>
      </Panel>
      {rentals && (
        <Panel className="rental-section">
          <PanelHeader
            title="Lịch sử hợp đồng"
            subtitle={`${rentals.total} hợp đồng`}
            icon="rental"
          />
          <div aria-busy={pending}>
            <RentalTable
              rentals={rentals.data}
              currency={context.business.currency}
            />
            <Pagination
              {...rentals}
              onPage={(page) =>
                startTransition(() =>
                  router.push(`/app/customers/${customer.id}?page=${page}`),
                )
              }
            />
          </div>
        </Panel>
      )}
      {editing && (
        <CustomerEditor
          businessId={context.business.id}
          customer={customer}
          onClose={() => setEditing(false)}
          onSaved={() => setMessage("Đã lưu thông tin khách hàng.")}
        />
      )}
    </>
  );
}
