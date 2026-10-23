"use client";
import { Drawer } from "@/components/ui/drawer";
import { Button, Input, Select } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { useMutation } from "@/lib/api-client/use-mutation";
import type { GpsDevice, GpsDeviceCreate, GpsDeviceUpdate } from "./types";
export function DeviceEditor({
  businessId,
  device,
  onClose,
  onSaved,
}: {
  businessId: string;
  device: GpsDevice | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const mutation = useMutation(businessId);
  return (
    <Drawer
      busy={mutation.busy}
      title={device ? "Chỉnh sửa thiết bị GPS" : "Đăng ký thiết bị GPS"}
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
    >
      <div className="panel-body">
        <MutationNotice {...mutation} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const fields = {
              label: String(form.get("label")).trim(),
              status: form.get("status") as "ACTIVE" | "INACTIVE",
            };
            let ok;
            if (device) {
              const body: GpsDeviceUpdate = fields;
              ok = await mutation.mutate({
                path: `/gps-devices/${device.id}`,
                body,
              });
            } else {
              const body: GpsDeviceCreate = {
                ...fields,
                provider: String(form.get("provider")).trim().toLowerCase(),
                deviceUid: String(form.get("deviceUid")).trim(),
              };
              ok = await mutation.mutate({
                path: "/gps-devices",
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
              Nhà cung cấp
              <Input
                name="provider"
                defaultValue={device?.provider ?? ""}
                readOnly={!!device}
                required
                maxLength={40}
                pattern="[A-Za-z0-9][A-Za-z0-9_\-]{0,39}"
                title="Tối đa 40 ký tự: chữ cái, chữ số, gạch nối hoặc gạch dưới."
              />
              <small>
                Mã nhà cung cấp được chuẩn hóa chữ thường. Không đổi sau khi
                đăng ký.
              </small>
            </label>
            <label className="form-field">
              UID thiết bị
              <Input
                name="deviceUid"
                defaultValue={device?.deviceUid ?? ""}
                readOnly={!!device}
                required
                maxLength={128}
                pattern="[A-Za-z0-9][A-Za-z0-9:._\-]{0,127}"
                title="Chữ cái, chữ số, dấu hai chấm, chấm, gạch dưới hoặc gạch nối."
              />
              <small>
                Phân biệt chữ hoa/thường. UID và nhà cung cấp xác định thiết bị
                duy nhất, không đổi sau khi đăng ký.
              </small>
            </label>
            <label className="form-field">
              Nhãn thiết bị
              <Input
                name="label"
                defaultValue={device?.label ?? ""}
                maxLength={120}
              />
            </label>
            <label className="form-field">
              Trạng thái vòng đời
              <Select name="status" defaultValue={device?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Ngưng hoạt động</option>
              </Select>
              <small>
                Thiết bị đang gắn phải được tháo khỏi xe trước khi ngưng hoạt
                động.
              </small>
            </label>
            <div className="inline">
              <Button type="submit" loading={mutation.busy}>
                {mutation.busy ? "Đang lưu…" : "Lưu thiết bị"}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                Hủy
              </Button>
            </div>
          </fieldset>
        </form>
      </div>
    </Drawer>
  );
}
