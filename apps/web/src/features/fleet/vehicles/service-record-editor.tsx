"use client";
import { useState } from "react";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { Input, Select, Textarea } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { useMutation } from "@/lib/api-client/use-mutation";
import { serviceKindLabels, vietnamToday, type ServiceKind } from "./compliance";
import type { ServiceRecordCreate } from "./types";

export function ServiceRecordEditor({
  businessId,
  vehicleId,
  initialKind,
  onClose,
  onSaved,
}: {
  businessId: string;
  vehicleId: string;
  initialKind: ServiceKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useMutation(businessId);
  const [kind, setKind] = useState<ServiceKind>(initialKind);
  return (
    <FormDialog
      busy={mutation.busy}
      title="Ghi nhận dịch vụ"
      description="Lịch sử không sửa/xóa được. Ngày hạn mới sẽ cập nhật hồ sơ xe."
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
      footer={
        <DialogActions
          formId="service-record-form"
          busy={mutation.busy}
          onCancel={onClose}
          submitLabel="Ghi nhận"
        />
      }
    >
      <div>
        <MutationNotice {...mutation} />
        <form
          id="service-record-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const text = (name: string) => String(form.get(name) ?? "").trim();
            const body: ServiceRecordCreate = {
              kind,
              performedOn: text("performedOn"),
              ...(text("odometer") ? { odometer: Number(text("odometer")) } : {}),
              ...(text("costVnd")
                ? { costVnd: text("costVnd").replace(/[.,\s]/g, "") }
                : {}),
              ...(text("notes") ? { notes: text("notes") } : {}),
              ...(text("nextDueOn") ? { nextDueOn: text("nextDueOn") } : {}),
              ...(kind === "MAINTENANCE" && text("nextDueOdometer")
                ? { nextDueOdometer: Number(text("nextDueOdometer")) }
                : {}),
            };
            const ok = await mutation.mutate({
              path: `/vehicles/${vehicleId}/service-records`,
              method: "POST",
              body,
            });
            if (ok) {
              onSaved();
              onClose();
            }
          }}
        >
          <fieldset disabled={mutation.busy}>
            <div className="form-grid">
              <label className="form-field">
                Loại dịch vụ
                <Select
                  name="kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as ServiceKind)}
                >
                  {Object.entries(serviceKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="form-field">
                Ngày thực hiện (VN)
                <Input
                  name="performedOn"
                  type="date"
                  required
                  max={vietnamToday()}
                  defaultValue={vietnamToday()}
                />
              </label>
              <label className="form-field">
                Số km
                <Input name="odometer" type="number" min={0} max={2147483647} step={1} />
              </label>
              <label className="form-field">
                Chi phí (₫, tùy chọn)
                <Input name="costVnd" inputMode="numeric" pattern="[0-9.,\s]{1,20}" />
              </label>
              <label className="form-field">
                {kind === "MAINTENANCE"
                  ? "Ngày bảo dưỡng tiếp theo"
                  : kind === "REGISTRATION"
                    ? "Ngày hết hạn đăng kiểm mới"
                    : "Ngày hết hạn bảo hiểm mới"}
                <Input name="nextDueOn" type="date" />
              </label>
              {kind === "MAINTENANCE" && (
                <label className="form-field">
                  Mốc km bảo dưỡng tiếp theo
                  <Input
                    name="nextDueOdometer"
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                  />
                </label>
              )}
            </div>
            <label className="form-field">
              Ghi chú
              <Textarea name="notes" maxLength={2000} rows={3} />
            </label>
          </fieldset>
        </form>
      </div>
    </FormDialog>
  );
}
