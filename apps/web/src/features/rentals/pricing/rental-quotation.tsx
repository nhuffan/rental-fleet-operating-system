import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/query";
import { formatVnd } from "./policy";
import { QuotationSummary } from "./quotation-summary";
import type { Rental } from "../types";
import "./pricing.css";
export function RentalQuotation({ rental }: { rental: Rental }) {
  const snapshot = rental.quotation;
  if (!snapshot)
    return (
      <Panel>
        <PanelHeader
          title="Giá thuê trên hợp đồng"
          icon="wallet"
          action={
            <Badge tone="neutral">
              {rental.pricingDraft
                ? "Giá bản nháp"
                : "Giá thủ công / hợp đồng cũ"}
            </Badge>
          }
        />
        <div className="panel-body">
          <p>
            {rental.pricingDraft
              ? "Giá đang ở bản nháp. Bảng giá được kiểm tra lại và bản chụp giá được khóa khi xác nhận đặt xe."
              : "Hợp đồng chưa có bản chụp báo giá. Giữ nguyên giá đã nhập, không tự tính lại theo bảng giá hiện tại."}
          </p>
          {rental.pricingDraft?.overrideReason && (
            <p className="rental-notes">
              <strong>Lý do thỏa thuận:</strong>{" "}
              {rental.pricingDraft.overrideReason}
            </p>
          )}
          <p className="quiet">
            Giá hợp đồng không phải khoản tiền đã thu. Xem các giao dịch thực tế
            ở phần Thu chi & tiền cọc.
          </p>
        </div>
      </Panel>
    );
  return (
    <Panel>
      <PanelHeader
        title="Giá thuê đã xác nhận"
        icon="wallet"
        action={
          <Badge tone={snapshot.mode === "CALCULATED" ? "info" : "warning"}>
            {snapshot.mode === "CALCULATED"
              ? "Theo bảng giá"
              : snapshot.mode === "OVERRIDE"
                ? "Giá thỏa thuận thay thế"
                : "Giá thỏa thuận thủ công"}
          </Badge>
        }
      />
      <div className="panel-body">
        {snapshot.breakdown ? (
          <QuotationSummary breakdown={snapshot.breakdown} />
        ) : (
          <p className="quiet">
            Không có bảng giá tính được tại lúc thỏa thuận. Giá thủ công và lý
            do được lưu cùng hợp đồng.
          </p>
        )}
        <div className="pricing-total">
          <span>Giá thuê đã chốt (VND)</span>
          <strong>{formatVnd(snapshot.agreedAmount)}</strong>
        </div>
        {snapshot.overrideReason && (
          <p className="rental-notes">
            <strong>Lý do thỏa thuận:</strong> {snapshot.overrideReason}
          </p>
        )}
        <p className="pricing-source">
          Xác nhận lúc {formatDate(snapshot.createdAt)} · Bản chụp giá được giữ
          nguyên khi bảng giá thay đổi.
        </p>
        <p className="quiet">
          Gia hạn không tự tính lại giá đã chốt. Thời gian trong bản chụp là
          lịch lúc xác nhận. Báo giá không tự tạo khoản thu, tiền cọc hoặc chi
          phí.
        </p>
      </div>
    </Panel>
  );
}
