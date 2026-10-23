"use client";
import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button, Input, Select, Textarea } from "@/components/ui/primitives";
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
    <Drawer
      busy={mutation.busy}
      title={customer ? "Chỉnh sửa khách hàng" : "Thêm khách hàng"}
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
    >
      <div className="panel-body">
        <MutationNotice
          error={validation || mutation.error}
          message={mutation.message}
        />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const body: CustomerCreate = {
              name: String(form.get("name")).trim(),
              phone: String(form.get("phone")).trim(),
              email: String(form.get("email")).trim(),
              notes: String(form.get("notes")).trim(),
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
            <div className="inline">
              <Button type="submit" loading={mutation.busy}>
                {mutation.busy ? "Đang lưu…" : "Lưu khách hàng"}
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
