import { redirect } from "next/navigation";
import { api, currentContext } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { ReportsPanel } from "@/features/reports/reports-panel";
import { apiRange, reportFilters } from "@/features/reports/period";
import type { ReportSummary } from "@/features/reports/types";
import { queryString, type SearchParams } from "@/lib/query";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await currentContext();
  if (!context.permissions.includes("report.read")) redirect("/access-denied");
  const filters = reportFilters(await searchParams);
  const summary = await api<ReportSummary>(
    `/reports/summary?${queryString(apiRange(filters))}`,
  );
  return (
    <>
      <PageHeader
        title="Báo cáo"
        description="Doanh thu, chi phí, công suất khai thác xe và xuất dữ liệu CSV từ giao dịch đã ghi nhận."
      />
      <ReportsPanel
        key={context.business.id}
        summary={summary}
        filters={filters}
      />
    </>
  );
}
