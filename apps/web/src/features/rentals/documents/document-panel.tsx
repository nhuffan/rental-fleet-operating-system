"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Notice, Panel, PanelHeader } from "@/components/ui/primitives";
import { ConfirmDialog, DialogActions } from "@/components/ui/form-dialog";
import { Icon } from "@/components/ui/icon";
import { useMutation } from "@/lib/api-client/use-mutation";
import { documentDate } from "./presentation";
import "@/styles/print-documents.css";
import type {
  ContractDocument,
  ContractDocuments,
  Rental,
  RentalInspection,
} from "../types";

type Version = ContractDocuments["versions"][number];
export type RentalDocumentIndex = {
  latest: Version | null;
  versions: Version[];
  versionCount: number;
  dataChanged: boolean;
};
export function RentalDocuments({
  rental,
  inspections,
  index,
  businessId,
  timeZone,
  canManage,
}: {
  rental: Rental;
  inspections: RentalInspection[];
  index: RentalDocumentIndex;
  businessId: string;
  timeZone: string;
  canManage: boolean;
}) {
  const mutation = useMutation(businessId);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const eligible = ["RESERVED", "ACTIVE", "COMPLETED"].includes(rental.status);
  const printHref = (kind: string, version?: number) =>
    `/app/rentals/${rental.id}/print/${kind}${version ? `?version=${version}` : ""}`;
  return (
    <Panel>
      <PanelHeader
        title="Tài liệu"
        subtitle="Phát hành bản chụp hợp đồng và in để ký tay."
        icon="rental"
      />
      <div className="panel-body rental-document-actions">
        {mutation.error && <Notice tone="danger">{mutation.error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <div className="rental-document-row">
          <div>
            <strong>Hợp đồng thuê xe</strong>
            <p className="quiet">
              {index.latest
                ? `${index.latest.docNumber} · Phiên bản ${index.latest.version} · ${documentDate(index.latest.issuedAt, timeZone)}`
                : "Chưa phát hành bản hợp đồng để in."}
            </p>
            {!eligible && (
              <p className="quiet">
                {rental.status === "DRAFT"
                  ? "Xác nhận đặt xe trước khi phát hành hợp đồng."
                  : "Hợp đồng đã hủy không thể phát hành thêm phiên bản."}
              </p>
            )}
          </div>
          <div className="inline">
            {index.latest && (
              <Link
                className="button button-secondary"
                href={printHref("contract", index.latest.version)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="rental" /> Xem/in v{index.latest.version}
              </Link>
            )}
            {canManage && (!index.latest || index.dataChanged) && (
              <Button
                type="button"
                disabled={!eligible || mutation.busy}
                onClick={() => setConfirm(true)}
              >
                <Icon name="check" />{" "}
                {index.latest ? "Phát hành lại" : "Phát hành hợp đồng"}
              </Button>
            )}
          </div>
        </div>
        {index.versions.length > 1 && (
          <details>
            <summary>Các phiên bản đã phát hành ({index.versionCount})</summary>
            <ul>
              {index.versions.map((version) => (
                <li key={version.version}>
                  <Link
                    className="link-brand"
                    href={printHref("contract", version.version)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {version.docNumber} · v{version.version}
                  </Link>{" "}
                  · {documentDate(version.issuedAt, timeZone)}
                </li>
              ))}
            </ul>
            {index.versionCount > index.versions.length && (
              <p className="quiet">
                Đang hiển thị {index.versions.length} phiên bản gần nhất.
              </p>
            )}
          </details>
        )}
        {(
          [
            ["handover", "HANDOVER", "Biên bản bàn giao"],
            ["return", "RETURN", "Biên bản trả xe"],
          ] as const
        ).map(([kind, type, label]) => {
          const available = inspections.some(
            (inspection) => inspection.type === type,
          );
          return (
            <div className="rental-document-row" key={kind}>
              <div>
                <strong>{label}</strong>
                <p className="quiet">
                  {available
                    ? "In từ số đo và checklist đã lưu trên biên bản."
                    : `Chưa có ${type === "HANDOVER" ? "biên bản bàn giao" : "biên bản trả xe"} để in.`}
                </p>
              </div>
              {available ? (
                <Link
                  className="button button-secondary"
                  href={printHref(kind)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="rental" /> Xem / in
                </Link>
              ) : (
                <Button type="button" variant="secondary" disabled>
                  Xem / in
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {confirm && (
        <ConfirmDialog
          title={
            index.latest ? "Phát hành phiên bản mới?" : "Phát hành hợp đồng?"
          }
          onClose={() => setConfirm(false)}
          busy={mutation.busy}
          footer={
            <DialogActions
              formId="issue-rental-contract"
              busy={mutation.busy}
              onCancel={() => setConfirm(false)}
              submitLabel="Phát hành"
            />
          }
        >
          <p>
            Hệ thống lưu một bản chụp bất biến của thông tin và điều khoản hiện
            tại. Các mục còn thiếu được để dòng chấm khi in để điền tay. Thao
            tác này không thu tiền hoặc tạo chữ ký.
          </p>
          <form
            id="issue-rental-contract"
            onSubmit={async (event) => {
              event.preventDefault();
              const issued = await mutation.mutateResult<ContractDocument>({
                path: `/rentals/${rental.id}/contract`,
                method: "POST",
              });
              if (issued) {
                setConfirm(false);
                setMessage(
                  `Đã phát hành ${issued.docNumber} · phiên bản ${issued.version}.`,
                );
              }
            }}
          />
        </ConfirmDialog>
      )}
    </Panel>
  );
}
