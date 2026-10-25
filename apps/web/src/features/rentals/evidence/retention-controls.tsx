"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Input,
  Panel,
  PanelHeader,
  Textarea,
} from "@/components/ui/primitives";
import { FormDialog, DialogActions } from "@/components/ui/form-dialog";
import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/query";
import type {
  Evidence,
  EvidenceImportant,
  EvidenceRentalHold,
  EvidenceReadAuthorization,
} from "../types";
import { EvidenceError, evidenceRequest } from "./client";
import { protectableMedia, readableMedia } from "./retention-presentation";

export const retentionChangedEvent = "rental-evidence-retention-changed";
export function notifyRetentionChanged(businessId: string, rentalId?: string) {
  window.dispatchEvent(
    new CustomEvent(retentionChangedEvent, {
      detail: { businessId, rentalId },
    }),
  );
}
export function matchesRetentionChange(
  event: Event,
  businessId: string,
  rentalId?: string,
) {
  const detail = (
    event as CustomEvent<{ businessId?: string; rentalId?: string }>
  ).detail;
  return (
    detail?.businessId === businessId &&
    (!detail.rentalId || !rentalId || detail.rentalId === rentalId)
  );
}
function ReasonDialog({
  title,
  description,
  submitLabel,
  children,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  submitLabel: string;
  children?: ReactNode;
  onClose: () => void;
  onSave: (data: FormData, reason: string) => Promise<void>;
}) {
  const id = useId();
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <FormDialog
      title={title}
      description={description}
      busy={busy}
      onClose={onClose}
      footer={
        <DialogActions formId={id} busy={busy} submitLabel={submitLabel} />
      }
    >
      {error && (
        <p role="alert" className="notice notice-danger">
          {error}
        </p>
      )}
      <form
        id={id}
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current) return;
          const data = new FormData(event.currentTarget);
          const reason = String(data.get("reason") ?? "").trim();
          if (!reason || reason.length > 2000) {
            setError("Nhập lý do từ 1 đến 2.000 ký tự.");
            return;
          }
          submitting.current = true;
          setBusy(true);
          setError("");
          try {
            await onSave(data, reason);
            onClose();
          } catch (error) {
            if (error instanceof EvidenceError && error.status === 401)
              router.replace("/login");
            setError(
              error instanceof Error
                ? error.message
                : "Chưa lưu được thay đổi.",
            );
          } finally {
            submitting.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="form-fieldset form-stack">
          {children}
          <label className="form-field">
            Lý do (bắt buộc)
            <Textarea name="reason" required maxLength={2000} rows={4} />
            <small>
              Lý do, người thực hiện và thời điểm được lưu trong lịch sử chứng
              cứ.
            </small>
          </label>
        </fieldset>
      </form>
    </FormDialog>
  );
}
export function RentalEvidenceHoldControl({
  rentalId,
  businessId,
}: {
  rentalId: string;
  businessId: string;
}) {
  const router = useRouter();
  const [hold, setHold] = useState<EvidenceRentalHold | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void evidenceRequest<EvidenceRentalHold>(
      businessId,
      `/rentals/${rentalId}/evidence/hold`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setHold(value);
          setError("");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof EvidenceError && error.status === 401)
          router.replace("/login");
        setError(
          error instanceof Error
            ? error.message
            : "Chưa tải được trạng thái giữ chứng cứ.",
        );
      });
    return () => controller.abort();
  }, [businessId, rentalId, attempt, router]);
  useEffect(() => {
    const refresh = (event: Event) => {
      if (matchesRetentionChange(event, businessId, rentalId))
        setAttempt((value) => value + 1);
    };
    window.addEventListener(retentionChangedEvent, refresh);
    return () => window.removeEventListener(retentionChangedEvent, refresh);
  }, [businessId, rentalId]);
  return (
    <Panel>
      <PanelHeader
        title="Bảo vệ chứng cứ hợp đồng"
        icon="shield"
        subtitle="Áp dụng cho cả bàn giao, nhận trả và chứng cứ được gắn sau này"
        action={
          <Button
            type="button"
            variant="secondary"
            disabled={!hold || !!error}
            onClick={() => setEditing(true)}
          >
            <Icon name="shield" />
            {hold?.active ? "Gỡ giữ chứng cứ" : "Giữ chứng cứ (Legal hold)"}
          </Button>
        }
      />
      <div className="evidence-retention-body">
        {error ? (
          <>
            <p role="alert" className="notice notice-danger">
              {error}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <Icon name="retry" />
              Thử lại
            </Button>
          </>
        ) : !hold ? (
          <p role="status">Đang tải trạng thái giữ chứng cứ…</p>
        ) : (
          <>
            <Badge tone={hold.active ? "warning" : "neutral"}>
              {hold.active
                ? hold.unresolvedDispute
                  ? "Đang giữ · Tranh chấp chưa giải quyết"
                  : "Đang giữ chứng cứ"
                : "Không có lệnh giữ đang mở"}
            </Badge>
            <p className="quiet">
              {hold.active
                ? "Chứng cứ còn tồn tại được bảo vệ khỏi lịch xóa cho đến khi Owner gỡ giữ bằng lý do rõ ràng. File đã bị xóa trước đó không thể khôi phục."
                : "Chỉ hợp đồng hoàn tất mới bắt đầu tính thời hạn lưu. Đánh dấu Quan trọng cho từng file hoặc giữ cả hồ sơ nếu còn tranh chấp."}
            </p>
            {hold.reason && (
              <p className="evidence-hold-reason">
                <strong>
                  Lý do {hold.active ? "giữ" : "thay đổi gần nhất"}:
                </strong>{" "}
                {hold.reason}
              </p>
            )}
            {hold.changedAt && (
              <p className="quiet">
                Cập nhật {formatDate(hold.changedAt)} · Người thực hiện (ID):{" "}
                <span className="inspection-reference">{hold.actorId}</span>
              </p>
            )}
          </>
        )}
      </div>
      {editing && hold && (
        <ReasonDialog
          title={
            hold.active ? "Gỡ giữ chứng cứ hợp đồng" : "Giữ chứng cứ hợp đồng"
          }
          description={
            hold.active
              ? "Sau khi gỡ giữ, thời hạn lưu của doanh nghiệp được áp dụng lại. File hết hạn có thể bị xóa vĩnh viễn."
              : "Giữ toàn bộ ảnh/video còn tồn tại của hợp đồng, gồm cả chứng cứ được gắn sau này. Không tự gỡ giữ khi hợp đồng hoàn tất."
          }
          submitLabel={
            hold.active ? "Xác nhận gỡ giữ" : "Xác nhận giữ chứng cứ"
          }
          onClose={() => setEditing(false)}
          onSave={async (data, reason) => {
            if (
              hold.active &&
              hold.unresolvedDispute &&
              data.get("resolved") !== "on"
            )
              throw new Error(
                "Xác nhận tranh chấp đã được giải quyết trước khi gỡ giữ.",
              );
            await evidenceRequest<EvidenceRentalHold>(
              businessId,
              `/rentals/${rentalId}/evidence/hold`,
              "PATCH",
              {
                active: !hold.active,
                unresolvedDispute: hold.active
                  ? false
                  : data.get("dispute") === "on",
                reason,
              },
            );
            notifyRetentionChanged(businessId, rentalId);
          }}
        >
          {hold.active && hold.unresolvedDispute ? (
            <label className="rental-checkbox">
              <Input type="checkbox" name="resolved" required />
              Tôi xác nhận tranh chấp đã được giải quyết và có thể gỡ giữ hồ sơ.
            </label>
          ) : !hold.active ? (
            <label className="rental-checkbox">
              <Input type="checkbox" name="dispute" />
              Có tranh chấp chưa được giải quyết.
            </label>
          ) : null}
        </ReasonDialog>
      )}
    </Panel>
  );
}
export function EvidenceImportantControl({
  item,
  rentalId,
  businessId,
}: {
  item: Evidence;
  rentalId: string;
  businessId: string;
}) {
  const [editing, setEditing] = useState(false);
  if (!protectableMedia(item)) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="small"
        onClick={() => setEditing(true)}
      >
        <Icon name="important" />
        {item.important ? "Bỏ đánh dấu quan trọng" : "Đánh dấu quan trọng"}
      </Button>
      {editing && (
        <ReasonDialog
          title={
            item.important ? "Bỏ đánh dấu quan trọng" : "Giữ file quan trọng"
          }
          description={
            item.important
              ? "File sẽ áp dụng lại thời hạn lưu của doanh nghiệp, trừ khi hồ sơ còn lệnh giữ chứng cứ."
              : "File quan trọng được giữ lại ngoài thời hạn thông thường, cho đến khi Owner bỏ đánh dấu bằng lý do rõ ràng."
          }
          submitLabel={item.important ? "Bỏ đánh dấu" : "Đánh dấu quan trọng"}
          onClose={() => setEditing(false)}
          onSave={async (_data, reason) => {
            await evidenceRequest<EvidenceImportant>(
              businessId,
              `/rentals/${rentalId}/evidence/${item.id}/important`,
              "PATCH",
              { important: !item.important, reason },
            );
            notifyRetentionChanged(businessId, rentalId);
          }}
        />
      )}
    </>
  );
}
export function EvidenceDownload({
  item,
  rentalId,
  businessId,
}: {
  item: Evidence;
  rentalId: string;
  businessId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  if (!readableMedia(item)) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="small"
        loading={busy}
        onClick={async () => {
          if (active.current) return;
          const controller = new AbortController();
          active.current = controller;
          setBusy(true);
          setError("");
          try {
            const read = await evidenceRequest<EvidenceReadAuthorization>(
              businessId,
              `/rentals/${rentalId}/evidence/${item.id}/download`,
              "GET",
              undefined,
              controller.signal,
            );
            if (controller.signal.aborted) return;
            const link = document.createElement("a");
            link.href = read.url;
            link.download = "";
            link.rel = "noopener noreferrer";
            document.body.append(link);
            link.click();
            link.remove();
          } catch (error) {
            if (controller.signal.aborted) return;
            if (error instanceof EvidenceError && error.status === 401)
              router.replace("/login");
            setError(
              error instanceof Error
                ? error.message
                : "Chưa tải được file chứng cứ.",
            );
          } finally {
            active.current = null;
            if (!controller.signal.aborted) setBusy(false);
          }
        }}
      >
        <Icon name="download" />
        Tải chứng cứ
      </Button>
      {error && (
        <p role="alert" className="evidence-error">
          {error}
        </p>
      )}
    </>
  );
}
