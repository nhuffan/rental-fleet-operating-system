"use client";
import Link from "next/link";
import { useState } from "react";
import type { Me } from "@rental-fleet/contracts";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import type { Rental } from "@/features/rentals/types";
import { commercialMoney } from "./query";
import { MovementActions } from "./movement-actions";
import { MovementEditor } from "./movement-editor";
import type { MovementKind, RentalCommercial } from "./types";
export function RentalCommercialPanel({
  data,
  rental,
  context,
}: {
  data: RentalCommercial;
  rental: Rental;
  context: Me;
}) {
  const [editor, setEditor] = useState<MovementKind | null>(null),
    [message, setMessage] = useState("");
  const rows = [
    ["Tiền thuê theo hợp đồng", data.contractedAmount],
    ["Tiền thuê đã thực thu", data.recordedRentalPayments],
    ["Tiền thuê còn thiếu", data.outstandingAmount],
    ["Tiền thuê thu vượt", data.overpaidAmount],
    ["Cọc yêu cầu theo hợp đồng", data.depositRequired],
    ["Cọc đã nhận", data.depositReceived],
    ["Cọc đã hoàn", data.depositRefunded],
    ["Cọc đã giữ lại", data.depositRetained],
    ["Cọc còn đang giữ", data.depositBalance],
    ["Doanh thu ghi nhận", data.summary.recordedRevenue],
    ["Chi phí vận hành", data.summary.operatingExpenses],
    ["Lợi nhuận ước tính", data.summary.estimatedProfit],
  ];
  return (
    <Panel>
      <PanelHeader
        title="Thu chi & tiền cọc thực tế"
        subtitle="Tổng hợp toàn bộ giao dịch của hợp đồng sau đảo · VND nguyên đồng"
        icon="wallet"
        action={
          <Link
            className="button button-secondary"
            href={`/app/commercial?rentalId=${rental.id}`}
          >
            Xem sổ giao dịch
          </Link>
        }
      />
      <MutationNotice error="" message={message} />
      <dl className="detail-list commercial-rental-totals">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{commercialMoney(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="panel-body">
        <Link
          className="button button-secondary"
          href={`/app/commercial/tolls?rentalId=${rental.id}`}
        >
          Đối soát phí đường bộ của hợp đồng
        </Link>
        <p className="quiet">
          Tiền theo hợp đồng được làm tròn đến đồng gần nhất (0,5 đồng làm tròn
          lên). Khoản thực thu và cọc chỉ tính từ sổ giao dịch. Xác nhận cọc
          trên hợp đồng không chứng minh đã có giao dịch cọc. Cọc yêu cầu không
          phải tiền thu. Lợi nhuận là ước tính từ giao dịch đã ghi nhận, chưa
          phải kế toán.
        </p>
        {context.permissions.includes("commercial.manage") && (
          <MovementActions rentalOnly onSelect={setEditor} />
        )}
      </div>
      {editor && (
        <MovementEditor
          kind={editor}
          businessId={context.business.id}
          rental={rental}
          onClose={() => setEditor(null)}
          onSaved={setMessage}
        />
      )}
    </Panel>
  );
}
