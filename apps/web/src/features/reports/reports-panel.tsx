"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MetricCard } from "@/components/data-display/metric-card";
import { DataTable } from "@/components/data-display/table";
import { DateInput, FilterBar } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { commercialMoney } from "@/features/commercial/query";
import { queryString } from "@/lib/query";
import {
  REPORT_EXPORT_KINDS,
  exportHref,
  exportLabels,
  monthLabel,
  percent,
  rentalStatusLabels,
  type ReportFilters,
} from "./period";
import type { ReportSummary } from "./types";

export function ReportsPanel({
  summary,
  filters,
}: {
  summary: ReportSummary;
  filters: ReportFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const months = summary.months.map((m) => ({ ...m, id: m.month }));
  const vehicles = summary.vehicles.map((v) => ({ ...v, id: v.vehicleId }));
  const statuses = summary.rentalsByStatus.map((s) => ({ ...s, id: s.status }));
  return (
    <>
      <MutationNotice message="" error={error} />
      <Panel>
        <PanelHeader
          title="Kỳ báo cáo"
          subtitle="Theo ngày Việt Nam (UTC+7), tối đa 366 ngày"
          icon="calendar"
        />
        <FilterBar
          key={JSON.stringify(filters)}
          busy={pending}
          aria-label="Chọn kỳ báo cáo"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const from = String(form.get("from")),
              until = String(form.get("until"));
            if (!from || !until || from > until) {
              setError("Chọn ngày bắt đầu trước hoặc cùng ngày kết thúc.");
              return;
            }
            if (
              (Date.parse(until) - Date.parse(from)) / 86_400_000 >=
              366
            ) {
              setError("Kỳ báo cáo tối đa 366 ngày.");
              return;
            }
            setError("");
            startTransition(() =>
              router.push(`/app/reports?${queryString({ from, until })}`, {
                scroll: false,
              }),
            );
          }}
        >
          <label className="form-field">
            Từ ngày (VN)
            <DateInput name="from" defaultValue={filters.from} required />
          </label>
          <label className="form-field">
            Đến hết ngày (VN)
            <DateInput name="until" defaultValue={filters.until} required />
          </label>
          <div className="filter-bar-actions">
            <Button variant="secondary" type="submit" loading={pending}>
              <Icon name="search" />
              Xem báo cáo
            </Button>
          </div>
        </FilterBar>
      </Panel>

      <div className="commercial-summary-grid">
        <MetricCard
          label="Doanh thu ghi nhận"
          value={commercialMoney(summary.recordedRevenue)}
          icon="wallet"
          tone="brand"
          description="Tiền thuê thực thu + thu khác + cọc giữ lại trong kỳ."
        />
        <MetricCard
          label="Chi phí vận hành"
          value={commercialMoney(summary.operatingExpenses)}
          icon="audit"
          tone="warning"
          description="Chi phí đã ghi nhận trong kỳ."
        />
        <MetricCard
          label="Lợi nhuận ước tính"
          value={commercialMoney(summary.estimatedProfit)}
          icon="grid"
          tone="success"
          description="Chưa phải lợi nhuận kế toán; không gồm chi phí chưa ghi."
        />
        <MetricCard
          label="Công suất khai thác"
          value={percent(summary.fleetUtilizationPercent)}
          icon="car"
          tone="info"
          description={`Thời gian thuê / thời gian kỳ trên ${summary.activeVehicles} xe đang hoạt động.`}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Theo tháng"
          subtitle="Doanh thu, chi phí và lợi nhuận ước tính theo giao dịch đã ghi nhận"
          icon="wallet"
        />
        <DataTable
          caption="Báo cáo theo tháng"
          rows={months}
          emptyState={{ title: "Chưa có giao dịch trong kỳ.", description: "Chọn kỳ khác hoặc ghi nhận giao dịch ở Thương mại." }}
          columns={[
            { key: "month", label: "Tháng", render: (r) => monthLabel(r.month) },
            {
              key: "revenue",
              label: "Doanh thu",
              render: (r) => commercialMoney(r.revenue),
            },
            {
              key: "expenses",
              label: "Chi phí",
              render: (r) => commercialMoney(r.expenses),
            },
            {
              key: "profit",
              label: "Lợi nhuận ước tính",
              render: (r) => commercialMoney(r.estimatedProfit),
            },
          ]}
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Hiệu quả theo xe"
          subtitle="Tối đa 50 xe đang hoạt động, xếp theo doanh thu rồi công suất"
          icon="car"
        />
        <DataTable
          caption="Hiệu quả theo xe"
          rows={vehicles}
          emptyState={{ title: "Chưa có xe đang hoạt động.", description: "Thêm hoặc kích hoạt xe để xem hiệu quả khai thác." }}
          columns={[
            {
              key: "vehicle",
              label: "Xe",
              render: (r) => `${r.licensePlate} · ${r.make} ${r.model}`,
            },
            {
              key: "revenue",
              label: "Doanh thu",
              render: (r) => commercialMoney(r.revenue),
            },
            {
              key: "hours",
              label: "Giờ thuê",
              render: (r) => `${r.rentedHours} giờ`,
            },
            {
              key: "utilization",
              label: "Công suất",
              render: (r) => percent(r.utilizationPercent),
            },
          ]}
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Hợp đồng bắt đầu trong kỳ"
          subtitle="Theo trạng thái hiện tại"
          icon="rental"
        />
        <DataTable
          caption="Hợp đồng theo trạng thái"
          rows={statuses}
          emptyState={{ title: "Chưa có hợp đồng bắt đầu trong kỳ.", description: "Chỉ tính hợp đồng có ngày nhận xe trong kỳ đã chọn." }}
          columns={[
            {
              key: "status",
              label: "Trạng thái",
              render: (r) => rentalStatusLabels[r.status] ?? r.status,
            },
            { key: "count", label: "Số hợp đồng", render: (r) => r.count },
          ]}
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Xuất CSV"
          subtitle="UTF-8, tối đa 10.000 dòng. Không gồm số CCCD/GPLX, địa chỉ hoặc ghi chú. Ô bắt đầu bằng = + - @ được thêm dấu nháy để tránh chạy công thức."
          icon="download"
        />
        <div className="panel-body rental-form-actions">
          {REPORT_EXPORT_KINDS.map((kind) => (
            <a
              key={kind}
              className="button button-secondary"
              href={exportHref(kind, filters)}
              download
            >
              <Icon name="download" />
              {exportLabels[kind]}
            </a>
          ))}
        </div>
      </Panel>
    </>
  );
}
