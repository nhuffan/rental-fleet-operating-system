import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { queryString, type SearchParams } from "@/lib/query";
import { commercialContext } from "@/features/commercial/server";
import { tollFilters, tollApiFilters } from "@/features/commercial/tolls/query";
import { TollPanel } from "@/features/commercial/tolls/toll-panel";
import type { TollPage } from "@/features/commercial/tolls/types";
export default async function TollTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await commercialContext();
  const filters = tollFilters(await searchParams);
  const initial = await api<TollPage>(
    `/tolls?${queryString(tollApiFilters(filters))}`,
  );
  return (
    <>
      <Link className="back-link" href="/app/commercial">
        ← Thương mại
      </Link>
      <PageHeader
        title="Đối soát phí đường bộ"
        description="Nhập bảng kê CSV, xác nhận xe/hợp đồng và phê duyệt chi phí của doanh nghiệp."
      />
      <TollPanel
        key={context.business.id}
        initial={initial}
        context={context}
        filters={filters}
      />
    </>
  );
}
