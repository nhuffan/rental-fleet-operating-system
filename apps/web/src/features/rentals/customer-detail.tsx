"use client";
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
import { Pagination } from "@/components/data-display/table";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { formatDate } from "@/lib/query";
import { CustomerEditor } from "./customer-editor";
import { CustomerPortalAccess } from "./customer-portal-access";
import type { PortalAccessStatus } from "@/features/portal/types";
import { RentalTable } from "./rental-table";
import type { Customer, RentalPage } from "./types";
export function CustomerDetail({
  customer,
  rentals,
  portalAccess,
  context,
}: {
  customer: Customer;
  rentals: RentalPage | null;
  portalAccess: PortalAccessStatus;
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
            <dt>Số CCCD / giấy tờ tùy thân</dt>
            <dd>{customer.idNumber || "Chưa cập nhật"}</dd>
          </div>
          <div>
            <dt>Số giấy phép lái xe</dt>
            <dd>{customer.driverLicenseNumber || "Chưa cập nhật"}</dd>
          </div>
          <div>
            <dt>Hạng giấy phép lái xe</dt>
            <dd>{customer.driverLicenseClass || "Chưa cập nhật"}</dd>
          </div>
          <div>
            <dt>Địa chỉ</dt>
            <dd className="rental-notes">
              {customer.address || "Chưa cập nhật"}
            </dd>
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
      <CustomerPortalAccess
        businessId={context.business.id}
        customerId={customer.id}
        hasEmail={customer.email.trim() !== ""}
        active={customer.status === "ACTIVE"}
        status={portalAccess}
        canManage={context.permissions.includes("customer.manage")}
      />
      {rentals && (
        <Panel className="rental-section">
          <PanelHeader
            title="Lịch sử hợp đồng"
            subtitle={`${rentals.total} hợp đồng`}
            icon="rental"
          />
          <div className="pending-region" aria-busy={pending}>
            <RefreshStatus pending={pending} />
            <RentalTable
              rentals={rentals.data}
              currency={context.business.currency}
            />
            <Pagination
              disabled={pending}
              {...rentals}
              onPage={(page) =>
                startTransition(() =>
                  router.push(`/app/customers/${customer.id}?page=${page}`, {
                    scroll: false,
                  }),
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
