"use client";
import Link from "next/link";
import {
  Button,
  Input,
  Notice,
  RefreshStatus,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { QuotationSummary } from "./quotation-summary";
import { formatVnd, type BillingMode } from "./policy";
import type { RentalPricingState } from "./use-rental-pricing";
import "./pricing.css";
export function PricingFields({
  pricing,
  disabled = false,
  currency = "VND",
}: {
  pricing: RentalPricingState;
  disabled?: boolean;
  currency?: string;
}) {
  if (currency !== "VND")
    return (
      <Notice tone="warning">
        Bảng giá và báo giá hiện chỉ hỗ trợ VND. Không thể tạo báo giá cho đơn
        vị tiền tệ hiện tại.
      </Notice>
    );
  return (
    <section className="pricing-fields" aria-label="Báo giá tiền thuê">
      <label className="form-field">
        Cách tính tiền thuê
        <Select
          name="pricingBillingMode"
          value={pricing.billingMode}
          disabled={disabled}
          onChange={(event) =>
            pricing.setBillingMode(event.target.value as BillingMode | "AUTO")
          }
        >
          <option value="AUTO">Theo cấu hình bảng giá</option>
          <option value="DAILY">Theo ngày 24 giờ</option>
          <option value="HOURLY">Theo giờ</option>
        </Select>
        <small>
          Mặc định dùng đơn giá ngày nếu có, nếu không dùng đơn giá giờ. Bạn có
          thể chọn cách tính khác.
        </small>
      </label>
      <RefreshStatus
        pending={pricing.pending}
        label="Đang tính báo giá cho xe và thời gian đã chọn…"
      />
      {pricing.error && (
        <Notice tone="danger">
          {pricing.error}{" "}
          <Button
            type="button"
            variant="secondary"
            size="small"
            disabled={disabled}
            onClick={pricing.retry}
          >
            <Icon name="retry" /> Tải lại báo giá
          </Button>
        </Notice>
      )}
      {pricing.quote && (
        <div className="pricing-quote">
          {pricing.quote.available ? (
            <QuotationSummary breakdown={pricing.quote.breakdown!} />
          ) : (
            <Notice tone="warning">
              {pricing.quote.reason === "BILLING_MODE_UNAVAILABLE"
                ? "Bảng giá chưa có đơn giá cho cách tính đã chọn. Đổi cách tính hoặc nhập giá thỏa thuận."
                : "Chưa có bảng giá hiệu lực cho xe tại thời điểm nhận. Nhập giá thỏa thuận và lý do để tiếp tục."}{" "}
              <Link
                className="link-brand"
                href="/app/rentals/pricing"
                target="_blank"
                rel="noopener noreferrer"
              >
                Quản lý bảng giá
              </Link>
            </Notice>
          )}
          {pricing.quote.available && (
            <label className="rental-checkbox">
              <Input
                type="checkbox"
                name="pricingOverride"
                checked={pricing.override}
                disabled={disabled}
                onChange={(event) =>
                  pricing.changeAgreement({ override: event.target.checked })
                }
              />
              Dùng giá thỏa thuận thay cho giá tính
            </label>
          )}
          {pricing.manual && (
            <div className="form-grid">
              <label className="form-field">
                Giá thỏa thuận (VND)
                <Input
                  name="pricingOverrideAmount"
                  inputMode="numeric"
                  type="text"
                  pattern="(0|[1-9][0-9]{0,8})"
                  maxLength={9}
                  required
                  disabled={disabled}
                  value={pricing.amount}
                  onChange={(event) =>
                    pricing.changeAgreement({ amount: event.target.value })
                  }
                />
                <small>Số nguyên từ 0 đến 999.999.999 VND.</small>
              </label>
              <label className="form-field">
                Lý do giá thỏa thuận
                <Textarea
                  name="pricingOverrideReason"
                  required
                  minLength={3}
                  maxLength={2000}
                  rows={3}
                  disabled={disabled}
                  value={pricing.reason}
                  onChange={(event) =>
                    pricing.changeAgreement({ reason: event.target.value })
                  }
                />
              </label>
            </div>
          )}
          {pricing.selection && (
            <p className="pricing-total">
              <span>
                {pricing.manual
                  ? "Giá thỏa thuận"
                  : "Giá áp dụng trên hợp đồng"}
              </span>
              <strong>{formatVnd(pricing.agreedAmount)}</strong>
            </p>
          )}
        </div>
      )}
      <p className="quiet">
        Báo giá chỉ là điều khoản tiền thuê. Không tạo khoản thu, tiền cọc hoặc
        chi phí; server kiểm tra lại bảng giá khi lưu và xác nhận đặt xe.
      </p>
    </section>
  );
}
