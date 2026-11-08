"use client";
import type { Branch } from "@rental-fleet/contracts";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { Input, Select } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { useMutation } from "@/lib/api-client/use-mutation";
import type { Vehicle, VehicleCreate, VehicleUpdate } from "./types";
export function VehicleEditor({
  businessId,
  vehicle,
  branches,
  onClose,
  onSaved,
}: {
  businessId: string;
  vehicle: Vehicle | null;
  branches: Branch[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const mutation = useMutation(businessId);
  return (
    <FormDialog
      busy={mutation.busy}
      title={vehicle ? "Chỉnh sửa xe" : "Thêm xe"}
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
      footer={
        <DialogActions
          formId="vehicle-form"
          busy={mutation.busy}
          onCancel={onClose}
          submitLabel="Lưu xe"
        />
      }
    >
      <div>
        <MutationNotice {...mutation} />
        <form
          id="vehicle-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const branchId = String(form.get("branchId")) || null;
            const fields = {
              licensePlate: String(form.get("licensePlate"))
                .toUpperCase()
                .replace(/[\s.-]/g, ""),
              make: String(form.get("make")).trim(),
              model: String(form.get("model")).trim(),
              status: form.get("status") as "ACTIVE" | "INACTIVE",
              registrationExpiresOn: String(form.get("registrationExpiresOn")) || null,
              insuranceExpiresOn: String(form.get("insuranceExpiresOn")) || null,
              nextMaintenanceOn: String(form.get("nextMaintenanceOn")) || null,
              nextMaintenanceOdometer: String(form.get("nextMaintenanceOdometer"))
                ? Number(form.get("nextMaintenanceOdometer"))
                : null,
            };
            let ok;
            if (vehicle) {
              const body: VehicleUpdate = {
                ...fields,
                ...(branchId !== vehicle.branchId ? { branchId } : {}),
              };
              ok = await mutation.mutate({
                path: `/vehicles/${vehicle.id}`,
                body,
              });
            } else {
              const body: VehicleCreate = { ...fields, branchId };
              ok = await mutation.mutate({
                path: "/vehicles",
                method: "POST",
                body,
              });
            }
            if (ok) {
              onSaved?.();
              onClose();
            }
          }}
        >
          <fieldset disabled={mutation.busy}>
            <label className="form-field">
              Biển số
              <Input
                name="licensePlate"
                defaultValue={vehicle?.licensePlate ?? ""}
                required
                maxLength={32}
                onInput={(event) => {
                  const canonical = event.currentTarget.value
                    .toUpperCase()
                    .replace(/[\s.-]/g, "");
                  event.currentTarget.setCustomValidity(
                    /^[A-Z0-9]{4,16}$/.test(canonical)
                      ? ""
                      : "Biển số cần 4–16 chữ cái hoặc chữ số sau khi bỏ khoảng trắng, dấu chấm và gạch nối.",
                  );
                }}
                pattern="[A-Za-z0-9. \-]{4,32}"
                title="4–16 chữ cái hoặc chữ số sau khi bỏ dấu chấm, gạch nối và khoảng trắng."
              />
              <small>
                Biển số được viết hoa, bỏ khoảng trắng, dấu chấm và gạch nối.
                Phải duy nhất trong doanh nghiệp.
              </small>
            </label>
            <div className="form-grid">
              <label className="form-field">
                Hãng xe
                <Input
                  name="make"
                  defaultValue={vehicle?.make ?? ""}
                  required
                  maxLength={80}
                  pattern=".*\S.*"
                />
              </label>
              <label className="form-field">
                Mẫu xe
                <Input
                  name="model"
                  defaultValue={vehicle?.model ?? ""}
                  required
                  maxLength={80}
                  pattern=".*\S.*"
                />
              </label>
            </div>
            <label className="form-field">
              Chi nhánh
              <Select name="branchId" defaultValue={vehicle?.branchId ?? ""}>
                <option value="">Chưa phân chi nhánh</option>
                {branches
                  .filter(
                    (branch) =>
                      branch.status === "ACTIVE" ||
                      branch.id === vehicle?.branchId,
                  )
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.status === "ACTIVE" ? "" : " (đã vô hiệu hóa)"}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="form-field">
              Trạng thái vòng đời
              <Select name="status" defaultValue={vehicle?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Hoạt động</option>
                <option
                  value="INACTIVE"
                  disabled={!!vehicle?.currentAssignment}
                >
                  Ngưng hoạt động
                </option>
              </Select>
              {vehicle?.currentAssignment && (
                <small>
                  Tháo thiết bị đang gắn trước khi ngưng hoạt động xe.
                </small>
              )}
            </label>
            <div className="form-grid">
              <label className="form-field">
                Hạn đăng kiểm
                <Input
                  name="registrationExpiresOn"
                  type="date"
                  defaultValue={vehicle?.registrationExpiresOn ?? ""}
                />
              </label>
              <label className="form-field">
                Hạn bảo hiểm
                <Input
                  name="insuranceExpiresOn"
                  type="date"
                  defaultValue={vehicle?.insuranceExpiresOn ?? ""}
                />
              </label>
              <label className="form-field">
                Bảo dưỡng tiếp theo (ngày)
                <Input
                  name="nextMaintenanceOn"
                  type="date"
                  defaultValue={vehicle?.nextMaintenanceOn ?? ""}
                />
              </label>
              <label className="form-field">
                Bảo dưỡng tiếp theo (km)
                <Input
                  name="nextMaintenanceOdometer"
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  defaultValue={vehicle?.nextMaintenanceOdometer ?? ""}
                />
              </label>
            </div>
            <small>Để trống để xóa hạn. Hệ thống cảnh báo trước 30 ngày.</small>
          </fieldset>
        </form>
      </div>
    </FormDialog>
  );
}
