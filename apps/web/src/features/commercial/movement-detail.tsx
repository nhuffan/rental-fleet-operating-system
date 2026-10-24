"use client";
import Link from "next/link";
import { useState } from "react";
import type { Me } from "@rental-fleet/contracts";
import {
  Badge,
  Button,
  Panel,
  PanelHeader,
  Textarea,
} from "@/components/ui/primitives";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { useMutation } from "@/lib/api-client/use-mutation";
import { formatDate } from "@/lib/query";
import {
  commercialMoney,
  kindLabels,
  categoryLabels,
  statusLabels,
} from "./query";
import type { Movement } from "./types";
export function MovementDetail({
  movement,
  context,
}: {
  movement: Movement;
  context: Me;
}) {
  const [reversing, setReversing] = useState(false),
    [message, setMessage] = useState("");
  const mutation = useMutation(context.business.id);
  return (
    <>
      <MutationNotice error="" message={message} />
      <Panel>
        <PanelHeader
          title={kindLabels[movement.kind]}
          subtitle="Bản ghi bất biến · Số tiền nguyên đồng VND"
          icon="wallet"
          action={
            <Badge tone={movement.status === "POSTED" ? "success" : "neutral"}>
              {statusLabels[movement.status]}
            </Badge>
          }
        />
        <dl className="detail-list">
          <div>
            <dt>Số tiền</dt>
            <dd className="commercial-money">
              {commercialMoney(movement.amount)}
            </dd>
          </div>
          <div>
            <dt>Danh mục</dt>
            <dd>{categoryLabels[movement.category]}</dd>
          </div>
          <div>
            <dt>Thời điểm giao dịch (VN)</dt>
            <dd>{formatDate(movement.occurredAt)}</dd>
          </div>
          <div>
            <dt>Ghi nhận lúc (VN)</dt>
            <dd>{formatDate(movement.createdAt)}</dd>
          </div>
          <div>
            <dt>Tham chiếu</dt>
            <dd>{movement.reference || "Chưa có"}</dd>
          </div>
          {movement.rentalId && (
            <div>
              <dt>Hợp đồng</dt>
              <dd>
                <Link
                  className="fleet-record-link"
                  href={`/app/rentals/${movement.rentalId}`}
                >
                  #{movement.rentalId.slice(0, 8)}
                </Link>
              </dd>
            </div>
          )}
          {movement.vehicleId && (
            <div>
              <dt>Xe</dt>
              <dd>
                <Link
                  className="fleet-record-link"
                  href={`/app/vehicles/${movement.vehicleId}`}
                >
                  #{movement.vehicleId.slice(0, 8)}
                </Link>
              </dd>
            </div>
          )}
          {movement.reversalOf && (
            <div>
              <dt>Đảo bản ghi</dt>
              <dd>
                <Link
                  className="fleet-record-link"
                  href={`/app/commercial/${movement.reversalOf}`}
                >
                  Xem giao dịch gốc
                </Link>
              </dd>
            </div>
          )}
          {movement.reversedBy && (
            <div>
              <dt>Bút toán đảo</dt>
              <dd>
                <Link
                  className="fleet-record-link"
                  href={`/app/commercial/${movement.reversedBy}`}
                >
                  Xem bút toán đảo
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt>Ghi chú / lý do đảo</dt>
            <dd className="rental-notes">{movement.notes || "Chưa có"}</dd>
          </div>
        </dl>
        <div className="panel-body">
          <p className="quiet">
            Không sửa hoặc xóa giao dịch đã ghi nhận. Khi sai, đảo giao dịch rồi
            tạo bản ghi đúng. Lịch sử và liên kết được giữ nguyên.
          </p>
          {movement.status === "POSTED" &&
            context.permissions.includes("commercial.manage") && (
              <Button
                variant="secondary"
                onClick={() => {
                  mutation.clear();
                  setReversing(true);
                }}
              >
                Đảo giao dịch
              </Button>
            )}
        </div>
      </Panel>
      {reversing && (
        <FormDialog
          title="Đảo giao dịch"
          footer={
            <DialogActions
              formId="commercial-reversal-form"
              busy={mutation.busy}
              onCancel={() => setReversing(false)}
              submitLabel="Xác nhận đảo"
            />
          }
          busy={mutation.busy}
          onClose={() => {
            if (!mutation.busy) setReversing(false);
          }}
        >
          <div>
            <MutationNotice error={mutation.error} message="" />
            <p>
              Đảo {commercialMoney(movement.amount)} ·{" "}
              {kindLabels[movement.kind]}. Số dư cọc và lịch sử được kiểm tra
              lại trước khi lưu; không xóa giao dịch gốc.
            </p>
            <form
              id="commercial-reversal-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const reason = String(
                  new FormData(event.currentTarget).get("reason"),
                ).trim();
                if (
                  await mutation.mutate({
                    path: `/commercial/movements/${movement.id}/reverse`,
                    method: "POST",
                    body: { reason },
                  })
                ) {
                  setMessage(
                    "Đã đảo giao dịch. Bản ghi gốc và bút toán đảo được giữ lại.",
                  );
                  setReversing(false);
                }
              }}
            >
              <fieldset className="form-fieldset" disabled={mutation.busy}>
                <label className="form-field">
                  Lý do đảo{" "}
                  <Textarea
                    name="reason"
                    rows={4}
                    minLength={1}
                    maxLength={2000}
                    required
                  />
                </label>
              </fieldset>
            </form>
          </div>
        </FormDialog>
      )}
    </>
  );
}
