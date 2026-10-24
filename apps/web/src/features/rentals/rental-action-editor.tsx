"use client";
import { useState } from "react";
import { RentalInspectionEditor } from "./rental-inspection-editor";
import {
  ConfirmDialog,
  DialogActions,
  FormDialog,
} from "@/components/ui/form-dialog";
import { Button, Input, Textarea } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { useMutation } from "@/lib/api-client/use-mutation";
import { localDateTime, utcDateTime } from "@/lib/date-time";
import { RecordPicker } from "@/components/data-display/record-picker";
import { queryString } from "@/lib/query";
import type {
  Customer,
  VehicleAvailability,
  Rental,
  RentalUpdate,
} from "./types";
export type RentalAction =
  "reserve" | "handover" | "extend" | "return" | "cancel" | "edit";
const titles: Record<RentalAction, string> = {
  reserve: "Xác nhận đặt xe",
  handover: "Bàn giao và bắt đầu thuê",
  extend: "Gia hạn hợp đồng",
  return: "Nhận trả và hoàn thành",
  cancel: "Hủy hợp đồng",
  edit: "Chỉnh sửa hợp đồng",
};
type ActionEditorProps = {
  rental: Rental;
  action: RentalAction;
  businessId: string;
  currency: string;
  onClose: () => void;
  onSaved: (message: string) => void;
};
export function RentalActionEditor(props: ActionEditorProps) {
  if (props.action === "handover" || props.action === "return")
    return <RentalInspectionEditor {...props} action={props.action} />;
  return <RentalMetadataEditor {...props} action={props.action} />;
}
function RentalMetadataEditor({
  rental,
  action,
  businessId,
  currency,
  onClose,
  onSaved,
}: Omit<ActionEditorProps, "action"> & {
  action: Exclude<RentalAction, "handover" | "return">;
}) {
  const mutation = useMutation(businessId);
  const [error, setError] = useState("");
  const draft = rental.status === "DRAFT";
  const [range, setRange] = useState({
    startAt: localDateTime(rental.startAt),
    endAt: localDateTime(rental.endAt),
  });
  const [customerId, setCustomerId] = useState(rental.customerId);
  const [vehicleId, setVehicleId] = useState(rental.vehicleId);
  const [customerPicker, setCustomerPicker] = useState(false);
  const [vehiclePicker, setVehiclePicker] = useState(false);
  const startAt = utcDateTime(range.startAt);
  const endAt = utcDateTime(range.endAt);
  const validRange = !!startAt && !!endAt && endAt > startAt;
  const ActionDialog = action === "reserve" ? ConfirmDialog : FormDialog;
  return (
    <ActionDialog
      busy={mutation.busy}
      title={titles[action]}
      size={action === "edit" ? "wide" : undefined}
      dirty={
        range.startAt !== localDateTime(rental.startAt) ||
        range.endAt !== localDateTime(rental.endAt) ||
        customerId !== rental.customerId ||
        vehicleId !== rental.vehicleId
      }
      footer={
        <DialogActions
          formId="rental-edit-action"
          busy={mutation.busy}
          onCancel={onClose}
          submitLabel={titles[action]}
          submitIcon={action === "cancel" ? "close" : "check"}
        />
      }
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
    >
      <div>
        <p>
          <strong>{rental.vehicle.licensePlate}</strong> ·{" "}
          {rental.customer.name}
        </p>
        <MutationNotice error={error || mutation.error} message="" />
        {action === "edit" && draft && (
          <section className="rental-draft-selection">
            <p className="quiet">
              Bản nháp chưa giữ lịch. Bạn có thể đổi thời gian, xe và khách hàng
              trước khi xác nhận đặt.
            </p>
            <div className="form-grid">
              <label className="form-field">
                Nhận xe lúc
                <Input
                  form="rental-edit-action"
                  name="startAt"
                  type="datetime-local"
                  required
                  value={range.startAt}
                  onChange={(e) =>
                    setRange({ ...range, startAt: e.target.value })
                  }
                  disabled={mutation.busy}
                />
              </label>
              <label className="form-field">
                Trả xe dự kiến
                <Input
                  form="rental-edit-action"
                  name="endAt"
                  type="datetime-local"
                  required
                  value={range.endAt}
                  onChange={(e) =>
                    setRange({ ...range, endAt: e.target.value })
                  }
                  disabled={mutation.busy}
                />
              </label>
            </div>
            <p className="quiet">Thời gian theo giờ Việt Nam (UTC+7).</p>
            <div className="rental-form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.busy}
                onClick={() => setVehiclePicker(!vehiclePicker)}
              >
                {vehiclePicker ? "Ẩn danh sách xe" : "Đổi xe"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.busy}
                onClick={() => setCustomerPicker(!customerPicker)}
              >
                {customerPicker ? "Ẩn danh sách khách hàng" : "Đổi khách hàng"}
              </Button>
            </div>
            {vehiclePicker &&
              (validRange ? (
                <RecordPicker<VehicleAvailability>
                  key={`${startAt}:${endAt}`}
                  businessId={businessId}
                  path={`/vehicles/availability?${queryString({ startAt, endAt, availableOnly: "true" })}`}
                  title="Chọn xe sẵn sàng"
                  selected={vehicleId}
                  disabled={mutation.busy}
                  onSelect={(item) => setVehicleId(item?.id ?? "")}
                  render={(item) => (
                    <>
                      <strong>{item.licensePlate}</strong>
                      <small>
                        {item.make} {item.model}
                      </small>
                    </>
                  )}
                />
              ) : (
                <p role="alert">
                  Nhập thời gian trả sau thời gian nhận để tìm xe.
                </p>
              ))}
            {customerPicker && (
              <RecordPicker<Customer>
                businessId={businessId}
                path="/customers?status=ACTIVE&sort=name&order=asc"
                title="Chọn khách hàng"
                selected={customerId}
                disabled={mutation.busy}
                onSelect={(item) => setCustomerId(item?.id ?? "")}
                render={(item) => (
                  <>
                    <strong>{item.name}</strong>
                    <small>
                      {[item.phone, item.email].filter(Boolean).join(" · ")}
                    </small>
                  </>
                )}
              />
            )}
          </section>
        )}
        <form
          id="rental-edit-action"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const form = new FormData(e.currentTarget);
            let ok = false;
            if (action === "reserve")
              ok = await mutation.mutate({
                path: `/rentals/${rental.id}/reserve`,
                method: "POST",
              });
            if (action === "cancel")
              ok = await mutation.mutate({
                path: `/rentals/${rental.id}/cancel`,
                method: "POST",
                body: { notes: String(form.get("notes")).trim() },
              });
            if (action === "extend") {
              const endAt = utcDateTime(String(form.get("endAt")));
              if (!endAt || endAt <= rental.endAt) {
                setError("Thời gian trả mới phải sau thời gian trả hiện tại.");
                return;
              }
              ok = await mutation.mutate({
                path: `/rentals/${rental.id}/extend`,
                method: "POST",
                body: { endAt, rentalAmount: Number(form.get("rentalAmount")) },
              });
            }
            if (action === "edit") {
              const body: RentalUpdate = {
                rentalAmount: Number(form.get("rentalAmount")),
                depositRequiredAmount: Number(
                  form.get("depositRequiredAmount"),
                ),
                depositReceived: form.get("depositReceived") === "on",
                notes: String(form.get("notes")).trim(),
              };
              if (draft) {
                const startAt = utcDateTime(String(form.get("startAt")));
                const endAt = utcDateTime(String(form.get("endAt")));
                if (!startAt || !endAt || endAt <= startAt) {
                  setError("Thời gian trả phải sau thời gian nhận xe.");
                  return;
                }
                if (!customerId || !vehicleId) {
                  setError(
                    "Chọn đầy đủ xe và khách hàng trước khi lưu bản nháp.",
                  );
                  return;
                }
                body.startAt = startAt;
                body.endAt = endAt;
                body.customerId = customerId;
                body.vehicleId = vehicleId;
              }
              ok = await mutation.mutate({
                path: `/rentals/${rental.id}`,
                body,
              });
            }
            if (ok) {
              onSaved(`${titles[action]} thành công.`);
              onClose();
            }
          }}
        >
          <fieldset disabled={mutation.busy} className="form-fieldset">
            {action === "reserve" && (
              <p>
                Giữ lịch xe trong thời gian hợp đồng. Server sẽ kiểm tra lại xe
                hoạt động, khách hàng và lịch trùng trước khi xác nhận.
              </p>
            )}
            {action === "cancel" && (
              <>
                <p>
                  Hủy hợp đồng sẽ giải phóng lịch đã đặt. Hợp đồng và lịch sử
                  được giữ lại.
                </p>
                <label className="form-field">
                  Ghi chú hủy
                  <Textarea
                    name="notes"
                    maxLength={4000}
                    rows={4}
                    defaultValue={rental.notes}
                  />
                </label>
              </>
            )}
            {action === "extend" && (
              <>
                <p className="quiet">Thời gian theo giờ Việt Nam (UTC+7).</p>
                <label className="form-field">
                  Trả xe mới
                  <Input
                    name="endAt"
                    type="datetime-local"
                    required
                    defaultValue={localDateTime(rental.endAt)}
                  />
                  <small>Gia hạn sẽ kiểm tra lịch trùng trước khi lưu.</small>
                </label>
              </>
            )}
            {(action === "edit" || action === "extend") && (
              <label className="form-field">
                Tiền thuê ({currency})
                <Input
                  name="rentalAmount"
                  type="number"
                  min={0}
                  max={999999999.99}
                  step="0.01"
                  required
                  defaultValue={rental.rentalAmount}
                />
              </label>
            )}
            {action === "edit" && (
              <>
                <label className="form-field">
                  Tiền cọc yêu cầu ({currency})
                  <Input
                    name="depositRequiredAmount"
                    type="number"
                    min={0}
                    max={999999999.99}
                    step="0.01"
                    required
                    defaultValue={rental.depositRequiredAmount}
                  />
                </label>
                <label className="rental-checkbox">
                  <Input
                    name="depositReceived"
                    type="checkbox"
                    defaultChecked={rental.depositReceived}
                  />
                  Xác nhận cọc trên hợp đồng
                </label>
                <p className="quiet">
                  Xác nhận này không tạo giao dịch tiền cọc. Ghi nhận khoản cọc
                  thực tế tại phần Thu chi của hợp đồng.
                </p>
                <label className="form-field">
                  Ghi chú
                  <Textarea
                    name="notes"
                    rows={4}
                    maxLength={4000}
                    defaultValue={rental.notes}
                  />
                </label>
              </>
            )}
          </fieldset>
        </form>
      </div>
    </ActionDialog>
  );
}
