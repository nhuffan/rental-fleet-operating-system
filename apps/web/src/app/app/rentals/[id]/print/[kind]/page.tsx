import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { validId, type SearchParams } from "@/lib/query";
import { rentalContext } from "@/features/rentals/server";
import { EmptyState, Notice, Panel } from "@/components/ui/primitives";
import { PrintButton } from "@/features/rentals/documents/print-button";
import {
  ContractPrint,
  InspectionPrint,
} from "@/features/rentals/documents/print-content";
import {
  isPrintKind,
  printVersion,
  wholeVnd,
} from "@/features/rentals/documents/presentation";
import type {
  ContractDocument,
  ContractDocuments,
  Rental,
  RentalInspections,
} from "@/features/rentals/types";
import "@/styles/print-documents.css";

export default async function RentalPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; kind: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await rentalContext("rental.read");
  const { id, kind } = await params;
  if (!validId(id) || !isPrintKind(kind)) notFound();
  const query = await searchParams;
  const version =
    query.version === undefined ? null : printVersion(query.version);
  if (query.version !== undefined && version === null) notFound();
  let document: ContractDocument | null = null;
  let rental: Rental | null = null;
  let inspections: RentalInspections | null = null;
  if (kind === "contract") {
    document = version
      ? await api<ContractDocument>(`/rentals/${id}/contract/${version}`, {
          notFoundOn404: true,
        })
      : (
          await api<ContractDocuments>(`/rentals/${id}/contract`, {
            notFoundOn404: true,
          })
        ).latest;
  } else {
    [rental, inspections] = await Promise.all([
      api<Rental>(`/rentals/${id}`, { notFoundOn404: true }),
      api<RentalInspections>(`/rentals/${id}/inspections`, {
        notFoundOn404: true,
      }),
    ]);
  }
  const inspection = inspections?.data.find(
    (row) => row.type === (kind === "handover" ? "HANDOVER" : "RETURN"),
  );
  const available = kind === "contract" ? !!document : !!inspection;
  const moneySupported =
    !document ||
    (document.snapshot.business.currency === "VND" &&
      wholeVnd(document.snapshot.rental.rentalAmount) !== null &&
      wholeVnd(document.snapshot.rental.depositRequiredAmount) !== null);
  const customerId = document?.snapshot.missing.length
    ? (await api<Rental>(`/rentals/${id}`, { notFoundOn404: true })).customerId
    : null;
  return (
    <div className="rental-print-view">
      <div className="no-print print-toolbar">
        <Link className="button button-secondary" href={`/app/rentals/${id}`}>
          ← Chi tiết hợp đồng
        </Link>
        <PrintButton disabled={!available || !moneySupported} />
      </div>
      {!available ? (
        <Panel>
          <EmptyState
            title={
              kind === "contract"
                ? "Chưa phát hành hợp đồng"
                : "Chưa có biên bản"
            }
            description="Quay lại chi tiết hợp đồng để hoàn tất thao tác trước khi in."
            icon="rental"
          />
        </Panel>
      ) : (
        <>
          {document && document.snapshot.missing.length > 0 && (
            <div className="no-print print-warning">
              <Notice tone="warning">
                Thông tin còn thiếu: {document.snapshot.missing.join("; ")}. Bản
                in để dòng chấm để điền tay.{" "}
                <Link className="link-brand" href="/app/business">
                  Hồ sơ doanh nghiệp
                </Link>
                {" · "}
                <Link
                  className="link-brand"
                  href={`/app/customers/${customerId}`}
                >
                  Hồ sơ khách thuê
                </Link>
                . Bản đã phát hành được giữ nguyên; cập nhật hồ sơ rồi phát hành
                phiên bản mới nếu cần.
              </Notice>
            </div>
          )}
          {!moneySupported && (
            <div className="no-print print-warning">
              <Notice tone="warning">
                Bản in hiện hỗ trợ VND nguyên đồng. Tài liệu này có đơn vị tiền
                tệ khác hoặc số tiền lẻ; dữ liệu được giữ nguyên và không được
                làm tròn để in.
              </Notice>
            </div>
          )}
          {kind !== "contract" && (
            <div className="no-print print-warning">
              <Notice>
                Biên bản dùng số đo/checklist bất biến đã lưu. Thông tin doanh
                nghiệp và khách thuê ở phần đầu là hồ sơ hiện tại.
              </Notice>
            </div>
          )}
          {document ? (
            <ContractPrint document={document} />
          ) : rental && inspection ? (
            <InspectionPrint
              rental={rental}
              inspection={inspection}
              handover={
                inspections?.data.find((row) => row.type === "HANDOVER") ?? null
              }
              business={context.business}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
