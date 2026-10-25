import { Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/query";
import { formatVnd } from "./policy";
import type { PricingBreakdown } from "./types";
import "./pricing.css";
const units: Record<string, string> = {
  HOUR: "giờ",
  DAY: "ngày 24 giờ",
  EXTRA_HOUR: "giờ lẻ",
  DAY_CAP: "ngày (giới hạn giờ lẻ)",
  MINIMUM: "Điều chỉnh mức tối thiểu",
};
export function QuotationSummary({
  breakdown,
}: {
  breakdown: PricingBreakdown;
}) {
  return (
    <>
      <div className="pricing-quote-heading">
        <strong>Giá tính theo bảng giá</strong>
        <Badge tone="info">
          {breakdown.billingMode === "DAILY" ? "Theo ngày" : "Theo giờ"}
        </Badge>
      </div>
      <p className="pricing-source">
        {breakdown.rateName} ·{" "}
        {breakdown.rateSource === "VEHICLE"
          ? "Bảng giá riêng của xe"
          : "Giá mặc định doanh nghiệp"}{" "}
        · Phiên bản {breakdown.rateVersion}
      </p>
      <p className="pricing-source">
        Hiệu lực từ {formatDate(breakdown.effectiveFrom)}
        {breakdown.effectiveUntil
          ? ` đến trước ${formatDate(breakdown.effectiveUntil)}`
          : ", không đặt ngày kết thúc"}{" "}
        · Phí tối thiểu {formatVnd(breakdown.minimumCharge)}.
      </p>
      <ul className="pricing-breakdown">
        {breakdown.lines.map((line, index) => (
          <li key={`${line.kind}:${index}`}>
            <span>
              {line.kind === "MINIMUM"
                ? units[line.kind]
                : `${line.units} ${units[line.kind] ?? line.kind}`}
              <small>
                {line.kind === "MINIMUM"
                  ? "Bù tới mức phí tối thiểu"
                  : `${formatVnd(line.unitPrice)} / đơn vị`}
              </small>
            </span>
            <strong>{formatVnd(line.amount)}</strong>
          </li>
        ))}
      </ul>
      <div className="pricing-total">
        <span>Tiền thuê dự kiến</span>
        <strong>{formatVnd(breakdown.calculatedAmount)}</strong>
      </div>
      <p className="quiet">
        {formatDate(breakdown.startAt)} → {formatDate(breakdown.endAt)} · giờ
        Việt Nam. Một ngày là 24 giờ liên tục; phần giờ lẻ làm tròn lên. Bảng
        giá được chọn theo thời điểm nhận xe, không chia lại theo ngày đổi giá.
      </p>
    </>
  );
}
