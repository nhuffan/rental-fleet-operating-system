import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/primitives";
import { PrintButton } from "@/features/rentals/documents/print-button";
import { ContractPrint } from "@/features/rentals/documents/print-content";
import { wholeVnd } from "@/features/rentals/documents/presentation";
import { portalApi } from "@/features/portal/server";
import { portalVersion } from "@/features/portal/presentation";
import type { ContractDocument } from "@/features/rentals/types";
import { validId } from "@/lib/query";
import "@/styles/print-documents.css";

export default async function PortalContract({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  const parsed = portalVersion(version);
  if (!validId(id) || parsed === null) notFound();
  const document = await portalApi<ContractDocument>(
    `/portal/rentals/${id}/contract/${parsed}`,
    { notFoundOn404: true },
  );
  const moneySupported =
    document.snapshot.business.currency === "VND" &&
    wholeVnd(document.snapshot.rental.rentalAmount) !== null &&
    wholeVnd(document.snapshot.rental.depositRequiredAmount) !== null;
  return (
    <div className="rental-print-view">
      <div className="no-print print-toolbar">
        <Link className="button button-secondary" href={`/portal/rentals/${id}`}>
          ← Chi tiết hợp đồng
        </Link>
        <PrintButton disabled={!moneySupported} />
      </div>
      {!moneySupported && (
        <div className="no-print print-warning">
          <Notice tone="warning">
            Bản in hỗ trợ VND nguyên đồng. Hợp đồng này dùng đơn vị tiền khác hoặc
            số tiền lẻ nên không in; liên hệ doanh nghiệp.
          </Notice>
        </div>
      )}
      <ContractPrint document={document} />
    </div>
  );
}
