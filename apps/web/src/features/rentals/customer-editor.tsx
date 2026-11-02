"use client";
import { useState } from "react";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { Input, Select, Textarea } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { useMutation } from "@/lib/api-client/use-mutation";
import type { Customer, CustomerCreate } from "./types";
export function CustomerEditor({
  businessId,
  customer,
  onClose,
  onSaved,
}: {
  businessId: string;
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useMutation(businessId);
  const [validation, setValidation] = useState("");
  return (
    <FormDialog
      busy={mutation.busy}
      title={customer ? "Chỉnh sửa khách hàng" : "Thêm khách hàng"}
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
      footer={
        <DialogActions
          formId="customer-form"
          busy={mutation.busy}
          onCancel={onClose}
          submitLabel="Lưu khách hàng"
        />
      }
    >
      <div>
        <MutationNotice
          error={validation || mutation.error}
          message={mutation.message}
        />
        <form
          id="customer-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const body: CustomerCreate = {
              name: String(form.get("name")).trim(),
              phone: String(form.get("phone")).trim(),
              email: String(form.get("email")).trim(),
              notes: String(form.get("notes")).trim(),
              idNumber: String(form.get("idNumber")).trim(),
              address: String(form.get("address")).trim(),
              driverLicenseNumber: String(
                form.get("driverLicenseNumber"),
              ).trim(),
              driverLicenseClass: String(form.get("driverLicenseClass")).trim(),
              status: form.get("status") as "ACTIVE" | "INACTIVE",
            };
            if (body.phone && !/^\+?[0-9][0-9 -]{4,31}$/.test(body.phone)) {
              setValidation(
                "Số điện thoại gồm 5–32 ký tự: chữ số, khoảng trắng, dấu gạch ngang và dấu + ở đầu.",
              );
              return;
            }
            if (!body.phone && !body.email) {
              setValidation(
                "Nhập ít nhất số điện thoại hoặc email để liên hệ.",
              );
              return;
            }
            setValidation("");
            const ok = customer
              ? await mutation.mutate({
                  path: `/customers/${customer.id}`,
                  body,
                })
              : await mutation.mutate({
                  path: "/customers",
                  body,
                  method: "POST",
                });
            if (ok) {
              onSaved();
              onClose();
            }
          }}
        >
          <fieldset disabled={mutation.busy} className="form-fieldset">
            <label className="form-field">
              Tên khách hàng
              <Input
                name="name"
                required
                maxLength={120}
                defaultValue={customer?.name}
              />
            </label>
            <div className="form-grid">
              <label className="form-field">
                Số điện thoại
                <Input
                  name="phone"
                  type="tel"
                  maxLength={32}
                  defaultValue={customer?.phone ?? ""}
                />
                <small>
                  Nhập số điện thoại hoặc email; thông tin liên hệ có thể dùng
                  chung.
                </small>
              </label>
              <label className="form-field">
                Email
                <Input
                  name="email"
                  type="email"
                  maxLength={254}
                  defaultValue={customer?.email ?? ""}
                />
              </label>
            </div>
            <div className="form-section">
              <h3>Giấy tờ và địa chỉ</h3>
              <p>
                Các mục này không bắt buộc. Số giấy tờ đầy đủ chỉ dùng trong hồ
                sơ chi tiết và bản hợp đồng đã phát hành.
              </p>
              <div className="form-grid">
                <label className="form-field">
                  Số CCCD / giấy tờ tùy thân
                  <Input
                    name="idNumber"
                    type="text"
                    maxLength={32}
                    defaultValue={customer?.idNumber ?? ""}
                    autoComplete="off"
                  />
                </label>
                <label className="form-field">
                  Số giấy phép lái xe
                  <Input
                    name="driverLicenseNumber"
                    type="text"
                    maxLength={32}
                    defaultValue={customer?.driverLicenseNumber ?? ""}
                    autoComplete="off"
                  />
                </label>
                <label className="form-field">
                  Hạng giấy phép lái xe
                  <Input
                    name="driverLicenseClass"
                    type="text"
                    maxLength={8}
                    defaultValue={customer?.driverLicenseClass ?? ""}
                    autoComplete="off"
                  />
                </label>
              </div>
              <label className="form-field">
                Địa chỉ khách hàng
                <Textarea
                  name="address"
                  maxLength={500}
                  rows={2}
                  defaultValue={customer?.address ?? ""}
                  autoComplete="street-address"
                />
              </label>
            </div>
            <label className="form-field">
              Trạng thái
              <Select name="status" defaultValue={customer?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Ngưng hoạt động</option>
              </Select>
            </label>
            <label className="form-field">
              Ghi chú
              <Textarea
                name="notes"
                rows={4}
                maxLength={2000}
                defaultValue={customer?.notes ?? ""}
              />
            </label>
          </fieldset>
        </form>
      </div>
    </FormDialog>
  );
}
