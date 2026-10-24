import { redirect } from "next/navigation";
import { api, currentContext } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { AlertsPanel } from "@/features/alerts/alerts-panel";
import { alertFilters } from "@/features/alerts/query";
import type { AlertPage } from "@/features/alerts/types";
import { queryString, type SearchParams } from "@/lib/query";
export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await currentContext();
  if (!context.permissions.includes("alert.read")) redirect("/access-denied");
  const filters = alertFilters(await searchParams);
  const initial = await api<AlertPage>(`/alerts?${queryString(filters)}`);
  return (
    <>
      <PageHeader
        title="Cảnh báo vận hành"
        description="Theo dõi hợp đồng cần xử lý và độ mới của bản tin GPS TEST từ dữ liệu hiện có."
      />
      <AlertsPanel
        key={context.business.id}
        initial={initial}
        filters={filters}
      />
    </>
  );
}
