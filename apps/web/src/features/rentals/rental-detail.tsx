"use client";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { formatDate, queryString } from "@/lib/query";
import { formatMoney } from "./query";
import { RentalStatus } from "./rental-status";
import { RentalActionEditor, type RentalAction } from "./rental-action-editor";
import type { Rental, RentalInspection } from "./types";
import { RentalInspections } from "./rental-inspections";
import { RentalCommercialPanel } from "@/features/commercial/rental-commercial-panel";
import type { RentalCommercial } from "@/features/commercial/types";
export function RentalDetail({
  rental,
  context,
  initialMessage = "",
  tripRange,
  commercial,
  commercialIssue,
  inspections,
}: {
  rental: Rental;
  inspections: RentalInspection[];
  context: Me;
  initialMessage?: string;
  tripRange: { from: string; to: string } | null;
  commercial: RentalCommercial | null;
  commercialIssue?: "currency" | "unavailable";
}) {
  const router = useRouter();
  const [commercialRefreshing, startCommercialRefresh] = useTransition();
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
      {context.permissions.includes("trip.read") && (
        <div className="rental-form-actions">
          <Link
            className="button button-secondary"
            href={`/app/trips?${queryString({ rentalId: rental.id, vehicleId: rental.vehicleId, ...(tripRange ?? {}) })}`}
          >
            Xem hành trình giao cắt lịch thuê
          </Link>
        </div>
      )}
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
              <dt>Xác nhận cọc trên hợp đồng</dt>
              <dd>{rental.depositReceived ? "Đã nhận" : "Chưa nhận"}</dd>
            </div>
          </dl>
          <div className="panel-body">
            {canManage && !terminal && (
              <div className="rental-form-actions">
                {rental.status === "DRAFT" && (
                  <Button onClick={() => setEditor("reserve")}>
                    <Icon name="check" />
                    Xác nhận đặt xe
                  </Button>
                )}
                {rental.status === "RESERVED" && (
                  <Button onClick={() => setEditor("handover")}>
                    <Icon name="car" />
                    Bàn giao xe
                  </Button>
                )}
                {rental.status === "ACTIVE" && (
                  <Button onClick={() => setEditor("return")}>
                    <Icon name="check" />
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
              Số tiền ở đây là điều khoản hợp đồng. Khoản thu và số dư cọc thực
              tế được tính riêng từ sổ giao dịch bên dưới.
            </p>
          </div>
        </Panel>
      </div>
      <div id="rental-inspections">
        <RentalInspections inspections={inspections} />
      </div>
      {commercial && (
        <RentalCommercialPanel
          data={commercial}
          rental={rental}
          context={context}
        />
      )}
      {commercialIssue && (
        <Panel>
          <PanelHeader title="Thu chi & tiền cọc thực tế" icon="wallet" />
          <div className="panel-body" role="status">
            <p>
              {commercialIssue === "currency"
                ? "Sổ giao dịch hiện hỗ trợ VND. Doanh nghiệp đang dùng đơn vị tiền tệ khác; thông tin và thao tác hợp đồng vẫn khả dụng. Chưa có số liệu thu chi để hiển thị tại đây."
                : "Chưa thể tải số liệu thu chi của hợp đồng. Thông tin và thao tác hợp đồng vẫn khả dụng; vui lòng thử tải lại số liệu."}
            </p>
            {commercialIssue === "unavailable" && (
              <Button
                variant="secondary"
                loading={commercialRefreshing}
                onClick={() => startCommercialRefresh(() => router.refresh())}
              >
                Tải lại số liệu thu chi
              </Button>
            )}
          </div>
        </Panel>
      )}
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
