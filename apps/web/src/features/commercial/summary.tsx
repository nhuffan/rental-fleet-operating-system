import { Panel } from "@/components/ui/primitives";
import { commercialMoney } from "./query";
import type { CommercialSummary } from "./types";
export function SummaryCards({ summary }: { summary: CommercialSummary }) {
  const cards = [
    [
      "Doanh thu ghi nhận",
      "Recorded revenue",
      summary.recordedRevenue,
      "Tiền thuê thực thu + thu khác + cọc giữ lại.",
    ],
    [
      "Chi phí vận hành",
      "Operating expenses",
      summary.operatingExpenses,
      "Chi phí đã ghi nhận, gồm phí đường bộ nhập thủ công.",
    ],
    [
      "Lợi nhuận ước tính",
      "Estimated profit",
      summary.estimatedProfit,
      "Doanh thu ghi nhận trừ chi phí; chưa phải lợi nhuận kế toán.",
    ],
    [
      "Tiền cọc đang giữ",
      "Deposit held",
      summary.depositHeld,
      "Số dư cọc tích lũy đến ngày kết thúc, không phải doanh thu.",
    ],
  ];
  return (
    <div className="commercial-summary-grid">
      {cards.map(([label, english, value, note]) => (
        <Panel key={english}>
          <div className="commercial-stat">
            <span>{label}</span>
            <small>{english}</small>
            <strong>{commercialMoney(value)}</strong>
            <p>{note}</p>
          </div>
        </Panel>
      ))}
    </div>
  );
}
