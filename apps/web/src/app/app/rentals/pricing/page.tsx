import Link from "next/link";
import { PageHeader, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { pageNumber, queryString, type SearchParams } from "@/lib/query";
import { rentalContext } from "@/features/rentals/server";
import { RateCards } from "@/features/rentals/pricing/rate-cards";
import type { RateCardPage } from "@/features/rentals/pricing/types";
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await rentalContext("rental.read");
  const params = await searchParams;
  const filters = {
    page: pageNumber(params.page),
    limit: 20,
    scope:
      params.scope === "BUSINESS" || params.scope === "VEHICLE"
        ? params.scope
        : "",
    status:
      params.status === "ACTIVE" || params.status === "INACTIVE"
        ? params.status
        : "",
  };
  const initial =
    context.business.currency === "VND"
      ? await api<RateCardPage>(`/pricing/rates?${queryString(filters)}`)
      : null;
  return (
    <>
      <Link className="back-link" href="/app/rentals">
        ← Danh sách hợp đồng
      </Link>
      <PageHeader
        title="Bảng giá thuê xe"
        description="Cấu hình giá theo giờ, ngày và khoảng hiệu lực cho doanh nghiệp."
      />
      {initial ? (
        <RateCards
          key={context.business.id}
          context={context}
          initial={initial}
          filters={filters}
        />
      ) : (
        <Notice tone="warning">
          Bảng giá hiện chỉ hỗ trợ doanh nghiệp dùng VND.
        </Notice>
      )}
    </>
  );
}
