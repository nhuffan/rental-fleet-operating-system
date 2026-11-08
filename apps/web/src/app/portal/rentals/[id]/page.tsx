import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { PortalContractsTable } from "@/features/portal/portal-tables";
import { RentalStatus } from "@/features/rentals/rental-status";
import { portalApi } from "@/features/portal/server";
import { portalMoney } from "@/features/portal/presentation";
import type { PortalRentalDetail } from "@/features/portal/types";
import { formatDate, validId } from "@/lib/query";

export default async function PortalRental({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validId(id)) notFound();
  const rental = await portalApi<PortalRentalDetail>(`/portal/rentals/${id}`, {
    notFoundOn404: true,
  });
  return (
    <>
      <Link className="back-link" href="/portal">
        ← Hợp đồng của bạn
      </Link>
      <PageHeader
        title={`${rental.licensePlate} · ${rental.make} ${rental.model}`}
        description="Thông tin hợp đồng thuê xe. Cổng này chỉ để xem và in."
      />
      <Panel>
        <PanelHeader title="Thông tin thuê" icon="rental" />
        <dl className="detail-list">
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <RentalStatus status={rental.status} />
            </dd>
          </div>
          <div>
            <dt>Nhận xe (VN)</dt>
            <dd>{formatDate(rental.startAt)}</dd>
          </div>
          <div>
            <dt>Trả xe dự kiến (VN)</dt>
            <dd>{formatDate(rental.endAt)}</dd>
          </div>
          <div>
            <dt>Tiền thuê theo hợp đồng</dt>
            <dd>{portalMoney(rental.rentalAmount, rental.currency)}</dd>
          </div>
          <div>
            <dt>Tiền cọc yêu cầu</dt>
            <dd>{portalMoney(rental.depositRequiredAmount, rental.currency)}</dd>
          </div>
        </dl>
        <p className="panel-body quiet">
          Số tiền là giá trị theo hợp đồng, không phải xác nhận đã thanh toán. Cổng
          này chưa hỗ trợ thanh toán trực tuyến.
        </p>
      </Panel>
      <Panel>
        <PanelHeader
          title="Hợp đồng đã phát hành"
          subtitle="Mỗi phiên bản là bản chụp bất biến"
          icon="audit"
        />
        <PortalContractsTable rentalId={rental.id} contracts={rental.contracts} />
      </Panel>
    </>
  );
}
