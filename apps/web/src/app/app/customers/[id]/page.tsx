import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { CustomerDetail } from "@/features/rentals/customer-detail";
import { rentalContext } from "@/features/rentals/server";
import {
  pageNumber,
  validId,
  type SearchParams,
} from "@/lib/query";
import type { PortalAccessStatus } from "@/features/portal/types";
import type { Customer, RentalPage } from "@/features/rentals/types";
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await rentalContext("customer.read");
  const { id } = await params;
  if (!validId(id)) notFound();
  const page = pageNumber((await searchParams).page);
  const [customer, rentals, portalAccess] = await Promise.all([
    api<Customer>(`/customers/${id}`, { notFoundOn404: true }),
    context.permissions.includes("rental.read")
      ? api<RentalPage>(`/rentals?customerId=${id}&page=${page}&limit=20`)
      : Promise.resolve(null),
    api<PortalAccessStatus>(`/customers/${id}/portal-access`),
  ]);
  return (
    <>
      <Link className="back-link" href="/app/customers">
        ← Danh sách khách hàng
      </Link>
      <PageHeader
        title={customer.name}
        description="Hồ sơ và hợp đồng của khách hàng."
      />
      <CustomerDetail
        key={`${context.business.id}:${id}`}
        customer={customer}
        rentals={rentals}
        portalAccess={portalAccess}
        context={context}
      />
    </>
  );
}
