"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-display/table";
import { ConfirmDialog, DialogActions } from "@/components/ui/form-dialog";
import {
  Button,
  Notice,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { usePlatformMutation } from "@/lib/api-client/use-platform-mutation";
import { OwnerAccessLink } from "./owner-access-link";
import {
  canIssueOwnerLink,
  canPlatformAction,
  ownerAccessUnavailable,
} from "./provisioning-policy";
import type {
  PlatformBusinessDetail,
  PlatformBusinessRecord,
  PlatformOwnerLinkResponse,
} from "./types";
type Owner = PlatformBusinessDetail["owners"]["data"][number];

export function BusinessAccess({
  business,
  permissions,
}: {
  business: PlatformBusinessDetail;
  permissions: readonly string[];
}) {
  const router = useRouter();
  const mutation = usePlatformMutation();
  const [confirm, setConfirm] = useState<"status" | Owner | null>(null);
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const manage = canPlatformAction(permissions, "platform.business.manage");
  const issue = canPlatformAction(permissions, "platform.owner.access");
  const active = business.status === "ACTIVE";
  return (
    <>
      {message && <Notice tone="success">{message}</Notice>}
      <Panel>
        <PanelHeader
          title="Quyền Owner & trạng thái"
          icon="shield"
          subtitle="Quyền cấp phát nền tảng; không truy cập dữ liệu vận hành của doanh nghiệp."
          action={
            manage && (
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.busy}
                onClick={() => {
                  mutation.clear();
                  setConfirm("status");
                }}
              >
                <Icon name={active ? "close" : "check"} />
                {active ? "Tạm ngưng doanh nghiệp" : "Kích hoạt doanh nghiệp"}
              </Button>
            )
          }
        />
        <DataTable
          caption="Owner của doanh nghiệp"
          rows={business.owners.data.map((owner) => ({
            ...owner,
            id: owner.membershipId,
          }))}
          emptyState={{
            title: "Chưa có Owner",
            description: "Doanh nghiệp chưa có liên kết Owner để cấp lại link.",
          }}
          columns={[
            {
              key: "name",
              label: "Owner",
              render: (owner) => (
                <div>
                  <strong>{owner.displayName || "Chưa có tên hiển thị"}</strong>
                  <small className="rental-id">{owner.userId}</small>
                </div>
              ),
            },
            {
              key: "status",
              label: "Quyền truy cập",
              render: (owner) => <StatusBadge status={owner.status} />,
            },
            {
              key: "profile",
              label: "Hồ sơ",
              render: (owner) => <StatusBadge status={owner.profileStatus} />,
            },
            ...(issue
              ? [
                  {
                    key: "action",
                    label: "Thao tác",
                    render: (owner: Owner) => (
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={
                            mutation.busy ||
                            !canIssueOwnerLink(business.status, owner)
                          }
                          onClick={() => {
                            mutation.clear();
                            setConfirm(owner);
                          }}
                        >
                          <Icon name="retry" />
                          Cấp lại link
                        </Button>
                        {!canIssueOwnerLink(business.status, owner) && (
                          <small>
                            {ownerAccessUnavailable(business.status, owner)}
                          </small>
                        )}
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <p className="panel-body quiet">
          {business.owners.total > business.owners.data.length
            ? `Đang hiển thị ${business.owners.data.length} / ${business.owners.total} Owner. `
            : ""}
          Link cho phép đặt mật khẩu tài khoản. Chỉ gửi riêng cho đúng Owner;
          việc này không cấp quyền Superadmin.
        </p>
      </Panel>
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "status"
              ? active
                ? "Tạm ngưng doanh nghiệp?"
                : "Kích hoạt doanh nghiệp?"
              : "Cấp lại link cho Owner?"
          }
          busy={mutation.busy}
          onClose={() => setConfirm(null)}
          footer={
            <DialogActions
              formId="platform-access-confirm"
              busy={mutation.busy}
              onCancel={() => setConfirm(null)}
              submitLabel={
                confirm === "status"
                  ? active
                    ? "Tạm ngưng"
                    : "Kích hoạt"
                  : "Cấp link mới"
              }
            />
          }
        >
          {mutation.error && <Notice tone="danger">{mutation.error}</Notice>}
          {confirm === "status" ? (
            <p>
              {active
                ? `Owner sẽ không thể vào hoặc thao tác trong doanh nghiệp ${business.name} cho đến khi kích hoạt lại. Dữ liệu và lịch sử được giữ nguyên.`
                : `Owner có quyền truy cập đang hoạt động sẽ vào lại được doanh nghiệp ${business.name}.`}
            </p>
          ) : (
            <p>
              Cấp link đặt mật khẩu cho{" "}
              <strong>{confirm.displayName || "Owner này"}</strong>. Link mới có
              thể thay thế link đã cấp trước; hãy xác minh người nhận trước khi
              gửi.
            </p>
          )}
          <form
            id="platform-access-confirm"
            onSubmit={async (event) => {
              event.preventDefault();
              if (confirm === "status") {
                const result =
                  await mutation.mutateResult<PlatformBusinessRecord>({
                    path: `/platform/businesses/${business.id}/status`,
                    method: "PATCH",
                    body: { status: active ? "DISABLED" : "ACTIVE" },
                  });
                if (result) {
                  setConfirm(null);
                  setMessage(
                    result.status === "ACTIVE"
                      ? "Đã kích hoạt doanh nghiệp."
                      : "Đã tạm ngưng doanh nghiệp.",
                  );
                  router.refresh();
                }
              } else {
                const result =
                  await mutation.mutateResult<PlatformOwnerLinkResponse>({
                    path: `/platform/businesses/${business.id}/owner-links`,
                    method: "POST",
                    body: { membershipId: confirm.membershipId },
                  });
                if (result) {
                  setConfirm(null);
                  setAccessUrl(result.accessUrl);
                }
              }
            }}
          />
        </ConfirmDialog>
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
