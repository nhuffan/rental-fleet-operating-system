"use client";
import Link from "next/link";
import { useState } from "react";
import type { Me } from "@rental-fleet/contracts";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { formatDate } from "@/features/vehicles/query";
import { formatMoney } from "./query";
import { RentalStatus } from "./rental-status";
import { RentalActionEditor, type RentalAction } from "./rental-action-editor";
import type { Rental } from "./types";
export function RentalDetail({
  rental,
  context,
  initialMessage = "",
}: {
  rental: Rental;
  context: Me;
  initialMessage?: string;
}) {
  const [editor, setEditor] = useState<RentalAction | null>(null);
  const [message, setMessage] = useState(initialMessage);
  const canManage = context.permissions.includes("rental.manage");
  const terminal =
    rental.status === "COMPLETED" || rental.status === "CANCELLED";
  const milestones = [
    ["Tạo bản nháp", rental.createdAt],
    ["Xác nhận đặt xe", rental.reservedAt],
    ["Bàn giao / bắt đầu thuê", rental.handedOverAt],
    ["Nhận trả / hoàn thành", rental.returnedAt],
    ["Hủy hợp đồng", rental.cancelledAt],
  ].filter(([, at]) => !!at);
  return (
    <>
      <MutationNotice error="" message={message} />
      {rental.isOverdue && (
        <div className="notice notice-danger" role="status">
          Hợp đồng đang thuê đã quá giờ trả dự kiến. Quá hạn được tính theo thời
          gian hiện tại; trạng thái hợp đồng vẫn là Đang thuê.
        </div>
      )}
      <div className="rental-detail-grid">
        <Panel>
          <PanelHeader
            title="Thông tin hợp đồng"
            icon="rental"
            action={
              <RentalStatus status={rental.status} overdue={rental.isOverdue} />
            }
          />
          <dl className="detail-list">
            <div>
              <dt>Mã hợp đồng</dt>
              <dd className="rental-id">{rental.id}</dd>
            </div>
            <div>
              <dt>Xe</dt>
              <dd>
                <Link
                  className="fleet-record-link"
                  href={`/app/vehicles/${rental.vehicleId}`}
                >
                  {rental.vehicle.licensePlate}
                </Link>{" "}
                · {rental.vehicle.make} {rental.vehicle.model}
              </dd>
            </div>
            <div>
              <dt>Khách hàng</dt>
              <dd>
                <Link
                  className="fleet-record-link"
                  href={`/app/customers/${rental.customerId}`}
                >
                  {rental.customer.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Liên hệ</dt>
              <dd>
                {[rental.customer.phone, rental.customer.email]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
            <div>
              <dt>Nhận xe (VN)</dt>
              <dd>{formatDate(rental.startAt)}</dd>
            </div>
            <div>
              <dt>Trả dự kiến (VN)</dt>
              <dd>{formatDate(rental.endAt)}</dd>
            </div>
            <div>
              <dt>Odometer bàn giao</dt>
              <dd>
                {rental.odometerStart === null
                  ? "Chưa bàn giao"
                  : `${rental.odometerStart.toLocaleString("vi-VN")} km`}
              </dd>
            </div>
            <div>
              <dt>Odometer nhận trả</dt>
              <dd>
                {rental.odometerEnd === null
                  ? "Chưa nhận trả"
                  : `${rental.odometerEnd.toLocaleString("vi-VN")} km`}
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Chi phí & thao tác" icon="wallet" />
          <dl className="detail-list">
            <div>
              <dt>Tiền thuê</dt>
              <dd>
                {formatMoney(rental.rentalAmount, context.business.currency)}
              </dd>
            </div>
            <div>
              <dt>Cọc yêu cầu</dt>
              <dd>
                {formatMoney(
                  rental.depositRequiredAmount,
                  context.business.currency,
                )}
              </dd>
            </div>
            <div>
              <dt>Nhận cọc</dt>
              <dd>{rental.depositReceived ? "Đã nhận" : "Chưa nhận"}</dd>
            </div>
          </dl>
          <div className="panel-body">
            {canManage && !terminal && (
              <div className="rental-form-actions">
                {rental.status === "DRAFT" && (
                  <Button onClick={() => setEditor("reserve")}>
                    Xác nhận đặt xe
                  </Button>
                )}
                {rental.status === "RESERVED" && (
                  <Button onClick={() => setEditor("handover")}>
                    Bàn giao xe
                  </Button>
                )}
                {rental.status === "ACTIVE" && (
                  <Button onClick={() => setEditor("return")}>
                    Nhận trả xe
                  </Button>
                )}
                {["RESERVED", "ACTIVE"].includes(rental.status) && (
                  <Button
                    variant="secondary"
                    onClick={() => setEditor("extend")}
                  >
                    Gia hạn
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setEditor("edit")}>
                  Chỉnh sửa
                </Button>
                {["DRAFT", "RESERVED"].includes(rental.status) && (
                  <Button variant="ghost" onClick={() => setEditor("cancel")}>
                    Hủy hợp đồng
                  </Button>
                )}
              </div>
            )}
            <p className="quiet">
              {terminal
                ? "Hợp đồng đã kết thúc, dữ liệu được giữ để tra cứu."
                : !canManage
                  ? "Bạn có quyền xem hợp đồng. Quản lý doanh nghiệp thực hiện các thao tác."
                  : "Mỗi thao tác được kiểm tra lại trạng thái và lịch xe tại server."}
            </p>
            <p className="quiet">
              Cọc chỉ ghi nhận số tiền yêu cầu và trạng thái nhận; chưa có sổ
              giao dịch hoặc đối soát.
            </p>
          </div>
        </Panel>
      </div>
      <div className="fleet-profile-grid">
        <Panel>
          <PanelHeader title="Tiến trình hợp đồng" icon="audit" />
          <ol className="rental-timeline">
            {milestones.map(([label, at]) => (
              <li key={label}>
                <span className="rental-timeline-dot" />
                <div>
                  <strong>{label}</strong>
                  <small>{formatDate(at!)}</small>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel>
          <PanelHeader title="Ghi chú" icon="rental" />
          <p className="panel-body rental-notes">
            {rental.notes || "Chưa có ghi chú."}
          </p>
        </Panel>
      </div>
      {editor && (
        <RentalActionEditor
          rental={rental}
          action={editor}
          businessId={context.business.id}
          currency={context.business.currency}
          onClose={() => setEditor(null)}
          onSaved={setMessage}
        />
      )}
    </>
  );
}
