"use client";
import { useState } from "react";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/data-display/table";
import { Icon } from "@/components/ui/icon";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { commercialMoney } from "@/features/commercial/query";
import { formatDate } from "@/lib/query";
import {
  complianceState,
  complianceText,
  dueLabels,
  formatDay,
  serviceKindLabels,
  vietnamToday,
  type ServiceKind,
} from "./compliance";
import { ServiceRecordEditor } from "./service-record-editor";
import type { ServiceRecordPage, Vehicle } from "./types";

const tones = {
  NONE: "neutral",
  OK: "success",
  DUE_SOON: "warning",
  OVERDUE: "danger",
} as const;

export function CompliancePanel({
  businessId,
  vehicle,
  records,
  canEdit,
}: {
  businessId: string;
  vehicle: Vehicle;
  records: ServiceRecordPage;
  canEdit: boolean;
}) {
  const [kind, setKind] = useState<ServiceKind | null>(null);
  const [message, setMessage] = useState("");
  const today = vietnamToday();
  const items: [ServiceKind, string | null][] = [
    ["REGISTRATION", vehicle.registrationExpiresOn],
    ["INSURANCE", vehicle.insuranceExpiresOn],
    ["MAINTENANCE", vehicle.nextMaintenanceOn],
  ];
  return (
    <>
      <MutationNotice error="" message={message} />
      <Panel>
        <PanelHeader
          title="Hồ sơ vận hành"
          subtitle="Đăng kiểm, bảo hiểm, bảo dưỡng · Cảnh báo trước 30 ngày"
          icon="shield"
          action={
            canEdit && (
              <Button variant="secondary" onClick={() => setKind("MAINTENANCE")}>
                <Icon name="plus" />
                Ghi nhận dịch vụ
              </Button>
            )
          }
        />
        <dl className="detail-list">
          {items.map(([itemKind, due]) => {
            const { state, days } = complianceState(due, today);
            return (
              <div key={itemKind}>
                <dt>{dueLabels[itemKind]}</dt>
                <dd>
                  {due ? `${formatDay(due)} · ` : ""}
                  <Badge tone={tones[state]}>{complianceText(state, days)}</Badge>
                </dd>
              </div>
            );
          })}
          <div>
            <dt>Mốc km bảo dưỡng</dt>
            <dd>
              {vehicle.nextMaintenanceOdometer === null
                ? "Chưa khai báo"
                : `${new Intl.NumberFormat("vi-VN").format(vehicle.nextMaintenanceOdometer)} km`}
            </dd>
          </div>
        </dl>
        <DataTable
          caption="Lịch sử dịch vụ của xe"
          rows={records.data}
          emptyState={{ title: "Chưa có lịch sử dịch vụ" }}
          columns={[
            {
              key: "date",
              label: "Ngày thực hiện",
              render: (r) => formatDay(r.performedOn),
            },
            {
              key: "kind",
              label: "Loại",
              render: (r) => serviceKindLabels[r.kind as ServiceKind] ?? r.kind,
            },
            {
              key: "odometer",
              label: "Số km",
              render: (r) =>
                r.odometer === null
                  ? "—"
                  : new Intl.NumberFormat("vi-VN").format(r.odometer),
            },
            {
              key: "cost",
              label: "Chi phí ghi nhận",
              render: (r) => (r.costVnd === null ? "—" : commercialMoney(r.costVnd)),
            },
            { key: "notes", label: "Ghi chú", render: (r) => r.notes || "—" },
            {
              key: "created",
              label: "Ghi lúc",
              render: (r) => formatDate(r.createdAt),
            },
          ]}
        />
        <p className="panel-body quiet">
          {records.total > records.data.length
            ? `Hiển thị ${records.data.length}/${records.total} bản ghi gần nhất. `
            : ""}
          Lịch sử không sửa/xóa được. Chi phí ở đây chỉ để tham khảo; không tự
          tạo giao dịch thu chi — hãy ghi chi phí tại Thương mại nếu cần.
        </p>
      </Panel>
      {kind && (
        <ServiceRecordEditor
          businessId={businessId}
          vehicleId={vehicle.id}
          initialKind={kind}
          onClose={() => setKind(null)}
          onSaved={() => setMessage("Đã ghi nhận dịch vụ và cập nhật hạn xe.")}
        />
      )}
    </>
  );
}
