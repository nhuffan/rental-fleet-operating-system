"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { Button, Input, Notice } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { usePlatformMutation } from "@/lib/api-client/use-platform-mutation";
import { OwnerAccessLink } from "./owner-access-link";
import { canPlatformAction } from "./provisioning-policy";
import type { PlatformProvisioningResponse } from "./types";

export function CreateBusiness({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const router = useRouter();
  const mutation = usePlatformMutation();
  const [open, setOpen] = useState(false);
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  if (!canPlatformAction(permissions, "platform.business.create")) return null;
  return (
    <>
      <Button
        type="button"
        onClick={() => {
          mutation.clear();
          setOpen(true);
        }}
      >
        <Icon name="plus" />
        Tạo doanh nghiệp
      </Button>
      {open && (
        <FormDialog
          title="Tạo doanh nghiệp"
          description="Tạo không gian vận hành, chi nhánh đầu tiên và quyền Owner trong một thao tác."
          busy={mutation.busy}
          onClose={() => setOpen(false)}
          footer={
            <DialogActions
              formId="platform-business-create"
              busy={mutation.busy}
              submitLabel="Tạo doanh nghiệp"
              onCancel={() => setOpen(false)}
            />
          }
        >
          {mutation.error && <Notice tone="danger">{mutation.error}</Notice>}
          <form
            id="platform-business-create"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const value = (key: string) => String(form.get(key) ?? "").trim();
              const result =
                await mutation.mutateResult<PlatformProvisioningResponse>({
                  path: "/platform/businesses",
                  method: "POST",
                  body: {
                    name: value("name"),
                    timezone: value("timezone"),
                    currency: value("currency").toUpperCase(),
                    firstBranchName: value("firstBranchName"),
                    ownerEmail: value("ownerEmail").toLowerCase(),
                    ownerDisplayName: value("ownerDisplayName"),
                  },
                });
              if (result) {
                setOpen(false);
                setAccessUrl(result.accessUrl);
                router.refresh();
              }
            }}
          >
            <fieldset disabled={mutation.busy}>
              <label className="form-field">
                Tên doanh nghiệp
                <Input
                  name="name"
                  required
                  minLength={1}
                  maxLength={120}
                  pattern=".*\S.*"
                  autoFocus
                />
              </label>
              <div className="form-grid">
                <label className="form-field">
                  Múi giờ
                  <Input
                    name="timezone"
                    required
                    defaultValue="Asia/Ho_Chi_Minh"
                    maxLength={120}
                  />
                </label>
                <label className="form-field">
                  Tiền tệ
                  <Input
                    name="currency"
                    required
                    defaultValue="VND"
                    pattern="[A-Z]{3}"
                    maxLength={3}
                  />
                </label>
              </div>
              <label className="form-field">
                Chi nhánh đầu tiên
                <Input
                  name="firstBranchName"
                  required
                  defaultValue="Trụ sở chính"
                  maxLength={120}
                  pattern=".*\S.*"
                />
              </label>
              <div className="form-grid">
                <label className="form-field">
                  Email Owner
                  <Input
                    name="ownerEmail"
                    type="email"
                    required
                    autoComplete="off"
                    maxLength={254}
                  />
                </label>
                <label className="form-field">
                  Tên Owner
                  <Input
                    name="ownerDisplayName"
                    required
                    maxLength={120}
                    pattern=".*\S.*"
                  />
                </label>
              </div>
              <p className="quiet">
                Tài khoản có email này sẽ được cấp toàn quyền Owner. Nếu tài
                khoản đã tồn tại, hồ sơ và các doanh nghiệp khác của họ được giữ
                nguyên.
              </p>
            </fieldset>
          </form>
        </FormDialog>
      )}
      {accessUrl && (
        <OwnerAccessLink
          accessUrl={accessUrl}
          onClose={() => setAccessUrl(null)}
        />
      )}
    </>
  );
}
