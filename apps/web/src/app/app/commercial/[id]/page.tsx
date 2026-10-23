import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { validId } from "@/lib/query";
import { commercialContext } from "@/features/commercial/server";
import { MovementDetail } from "@/features/commercial/movement-detail";
import type { Movement } from "@/features/commercial/types";
export default async function MovementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await commercialContext(),
    { id } = await params;
  if (!validId(id)) notFound();
  const movement = await api<Movement>(`/commercial/movements/${id}`, {
    notFoundOn404: true,
  });
  return (
    <>
      <Link className="back-link" href="/app/commercial">
        ← Sổ giao dịch
      </Link>
      <PageHeader
        title={`Giao dịch #${id.slice(0, 8)}`}
        description="Lịch sử ghi nhận thu, chi và tiền cọc trong doanh nghiệp hiện tại."
      />
      <MovementDetail
        key={`${context.business.id}:${id}`}
        movement={movement}
        context={context}
      />
    </>
  );
}
