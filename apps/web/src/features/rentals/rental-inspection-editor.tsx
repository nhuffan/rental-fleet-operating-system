"use client";
import { useRef, useState } from "react";
import { FormDialog, DialogActions } from "@/components/ui/form-dialog";
import { Input, Select, Textarea } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { useMutation } from "@/lib/api-client/use-mutation";
import { EvidenceUploader } from "./evidence/evidence-uploader";
import { useEvidenceDraft } from "./evidence/use-evidence-draft";
import {
  conditionLabels,
  checklistLabels,
  inspectionItems,
} from "./inspection-fields";
import type { Rental, RentalInspectionInput } from "./types";

export function RentalInspectionEditor({
  rental,
  action,
  businessId,
  onClose,
  onSaved,
}: {
  rental: Rental;
  action: "handover" | "return";
  businessId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const mutation = useMutation(businessId);
  const evidence = useEvidenceDraft(
    rental.id,
    businessId,
    action === "return" ? "RETURN" : "HANDOVER",
  );
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [exterior, setExterior] = useState("");
  const [interior, setInterior] = useState("");
  const returning = action === "return";
  const title = returning
    ? "Nhận trả xe & lập biên bản"
    : "Bàn giao xe & lập biên bản";
  const damaged = exterior === "DAMAGED" || interior === "DAMAGED";
  const formId = `rental-${action}-inspection`;
  return (
    <FormDialog
      title={title}
      description={`${rental.vehicle.licensePlate} · ${rental.customer.name}`}
      size="wide"
      busy={mutation.busy}
      dirty={evidence.tasks.length > 0}
      onClose={onClose}
      footer={
        <DialogActions
          formId={formId}
          busy={mutation.busy}
          submitLabel={returning ? "Xác nhận nhận trả" : "Xác nhận bàn giao"}
          submitDisabled={
            evidence.working ||
            evidence.tasks.some(
              (item) => !["verified", "cancelled"].includes(item.stage),
            )
          }
        />
      }
    >
      <MutationNotice error={error || mutation.error} message="" />
      <form
        id={formId}
        className="inspection-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current) return;
          setError("");
          const form = new FormData(event.currentTarget);
          const odometerValue = String(form.get("odometer") ?? "").trim();
          const fuelValue = String(form.get("fuelPercent") ?? "").trim();
          const odometer = Number(odometerValue);
          const fuelPercent = Number(fuelValue);
          if (
            !odometerValue ||
            !Number.isInteger(odometer) ||
            odometer < 0 ||
            odometer > 2147483647 ||
            (returning && odometer < (rental.odometerStart ?? 0))
          ) {
            setError(
              returning
                ? "Odometer nhận trả phải bằng hoặc lớn hơn lúc bàn giao."
                : "Nhập odometer là số km nguyên từ 0 đến 2.147.483.647.",
            );
            return;
          }
          if (
            !fuelValue ||
            !Number.isInteger(fuelPercent) ||
            fuelPercent < 0 ||
            fuelPercent > 100
          ) {
            setError("Mức nhiên liệu phải là số nguyên từ 0 đến 100%.");
            return;
          }
          const exteriorCondition = String(form.get("exteriorCondition"));
          const interiorCondition = String(form.get("interiorCondition"));
          if (
            !Object.hasOwn(conditionLabels, exteriorCondition) ||
            !Object.hasOwn(conditionLabels, interiorCondition) ||
            inspectionItems.some(
              ({ name }) =>
                !Object.hasOwn(checklistLabels, String(form.get(name))),
            )
          ) {
            setError(
              "Kiểm tra và chọn đầy đủ tình trạng xe, phụ kiện và giấy tờ. Chọn Không áp dụng nếu phù hợp.",
            );
            return;
          }
          const damageNotes = String(form.get("damageNotes") ?? "").trim();
          if (
            (exteriorCondition === "DAMAGED" ||
              interiorCondition === "DAMAGED") &&
            !damageNotes
          ) {
            setError("Mô tả hư hỏng khi ngoại thất hoặc nội thất có hư hỏng.");
            return;
          }
          if (form.get("confirmed") !== "on") {
            setError("Xác nhận đã kiểm tra thực tế trước khi lưu biên bản.");
            return;
          }
          const evidenceIssue = evidence.validate();
          if (evidenceIssue) {
            setError(evidenceIssue);
            return;
          }
          const inspection: RentalInspectionInput = {
            fuelPercent,
            exteriorCondition:
              exteriorCondition as RentalInspectionInput["exteriorCondition"],
            interiorCondition:
              interiorCondition as RentalInspectionInput["interiorCondition"],
            spareTire: String(
              form.get("spareTire"),
            ) as RentalInspectionInput["spareTire"],
            tools: String(form.get("tools")) as RentalInspectionInput["tools"],
            registrationDocument: String(
              form.get("registrationDocument"),
            ) as RentalInspectionInput["registrationDocument"],
            insuranceDocument: String(
              form.get("insuranceDocument"),
            ) as RentalInspectionInput["insuranceDocument"],
            keys: String(form.get("keys")) as RentalInspectionInput["keys"],
            damageNotes,
            notes: String(form.get("notes") ?? "").trim(),
          };
          submitting.current = true;
          try {
            const ok = returning
              ? await mutation.mutate({
                  path: `/rentals/${rental.id}/return`,
                  method: "POST",
                  body: {
                    odometerEnd: odometer,
                    inspection,
                    evidenceUploadIds: evidence.uploadedIds,
                  },
                })
              : await mutation.mutate({
                  path: `/rentals/${rental.id}/handover`,
                  method: "POST",
                  body: {
                    odometerStart: odometer,
                    inspection,
                    evidenceUploadIds: evidence.uploadedIds,
                  },
                });
            if (ok) {
              evidence.markAttached();
              onSaved(
                returning
                  ? "Đã nhận trả xe, hoàn thành hợp đồng và lưu biên bản."
                  : "Đã bàn giao xe, bắt đầu thuê và lưu biên bản.",
              );
              onClose();
            }
          } finally {
            submitting.current = false;
          }
        }}
      >
        <fieldset
          disabled={mutation.busy}
          className="form-fieldset inspection-sections"
        >
          <section
            className="inspection-form-section"
            aria-labelledby={`${formId}-vehicle`}
          >
            <h3 id={`${formId}-vehicle`}>Thông tin xe</h3>
            <p className="quiet">
              {returning
                ? "Nhận trả sẽ hoàn thành hợp đồng và kết thúc việc giữ xe."
                : "Bàn giao sẽ bắt đầu thời gian thuê. Xe và lịch được kiểm tra lại khi lưu."}
            </p>
            <div className="form-grid">
              <label className="form-field">
                {returning
                  ? "Odometer nhận trả (km)"
                  : "Odometer bàn giao (km)"}
                <Input
                  name="odometer"
                  type="number"
                  required
                  min={returning ? (rental.odometerStart ?? 0) : 0}
                  max={2147483647}
                  step={1}
                />
                {returning && (
                  <small>
                    Khi bàn giao:{" "}
                    {rental.odometerStart?.toLocaleString("vi-VN") ??
                      "Chưa ghi nhận"}
                    {rental.odometerStart !== null ? " km" : ""}
                  </small>
                )}
              </label>
              <label className="form-field">
                Mức nhiên liệu (%)
                <Input
                  name="fuelPercent"
                  type="number"
                  required
                  min={0}
                  max={100}
                  step={1}
                />
                <small>0%: cạn · 100%: đầy. Ghi theo kiểm tra thực tế.</small>
              </label>
            </div>
          </section>
          <section
            className="inspection-form-section"
            aria-labelledby={`${formId}-checklist`}
          >
            <h3 id={`${formId}-checklist`}>Checklist</h3>
            <p className="quiet">
              Chọn rõ từng mục sau khi kiểm tra. Không áp dụng được lưu riêng
              với Thiếu.
            </p>
            <div className="form-grid">
              <label className="form-field">
                Ngoại thất
                <Select
                  aria-label="Ngoại thất"
                  name="exteriorCondition"
                  required
                  value={exterior}
                  onChange={(event) => setExterior(event.target.value)}
                >
                  <option value="" disabled>
                    Chọn tình trạng ngoại thất
                  </option>
                  {Object.entries(conditionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="form-field">
                Nội thất
                <Select
                  aria-label="Nội thất"
                  name="interiorCondition"
                  required
                  value={interior}
                  onChange={(event) => setInterior(event.target.value)}
                >
                  <option value="" disabled>
                    Chọn tình trạng nội thất
                  </option>
                  {Object.entries(conditionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              {inspectionItems.map(({ name, label }) => (
                <label key={name} className="form-field">
                  {label}
                  <Select
                    aria-label={label}
                    name={name}
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Chọn kết quả kiểm tra
                    </option>
                    {Object.entries(checklistLabels).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
          </section>
          <section
            className="inspection-form-section"
            aria-labelledby={`${formId}-notes`}
          >
            <h3 id={`${formId}-notes`}>Ghi chú</h3>
            <label className="form-field">
              Mô tả hư hỏng{damaged ? " (bắt buộc)" : " (nếu có)"}
              <Textarea
                name="damageNotes"
                rows={3}
                maxLength={2000}
                required={damaged}
              />
              <small>
                Mô tả vị trí và tình trạng hư hỏng đã ghi nhận, tối đa 2.000 ký
                tự.
              </small>
            </label>
            <label className="form-field">
              Ghi chú khác
              <Textarea name="notes" rows={3} maxLength={2000} />
            </label>
          </section>
          <EvidenceUploader draft={evidence} disabled={mutation.busy} />
          <div className="inspection-confirmation">
            <label className="rental-checkbox">
              <Input name="confirmed" type="checkbox" required />
              Tôi đã kiểm tra thực tế và xác nhận thông tin biên bản.
            </label>
            <p className="quiet">
              Biên bản được lưu cố định cùng thao tác{" "}
              {returning ? "nhận trả" : "bàn giao"}. Chênh lệch km, nhiên liệu
              hoặc hư hỏng không tự tạo phí hay trừ cọc.
            </p>
          </div>
        </fieldset>
      </form>
    </FormDialog>
  );
}
