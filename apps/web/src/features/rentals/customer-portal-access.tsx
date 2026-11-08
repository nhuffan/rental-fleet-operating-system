"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { OwnerAccessLink } from "@/features/platform/live/owner-access-link";
import type { PortalAccessLink, PortalAccessStatus } from "@/features/portal/types";
import { useMutation } from "@/lib/api-client/use-mutation";
import { formatDate } from "@/lib/query";

export function CustomerPortalAccess({
  businessId,
  customerId,
  hasEmail,
  active,
  status,
  canManage,
}: {
  businessId: string;
  customerId: string;
  hasEmail: boolean;
  active: boolean;
  status: PortalAccessStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const mutation = useMutation(businessId);
  // The one-time credential lives only in this component state until dismissed.
  const [link, setLink] = useState<string | null>(null);
  const blocked = !active
    ? "Kích hoạt khách hàng trước."
    : !hasEmail
      ? "Cần nhập email của khách trước."
      : "";
  return (
    <Panel>
      <PanelHeader
        title="Cổng khách thuê"
        subtitle="Khách tự xem và in hợp đồng của mình bằng tài khoản riêng"
        icon="shield"
        action={
          canManage && (
            <Button
              variant="secondary"
              disabled={mutation.busy || Boolean(blocked)}
              title={blocked || undefined}
              onClick={async () => {
                const result = await mutation.mutateResult<PortalAccessLink>({
                  path: `/customers/${customerId}/portal-access`,
                  method: "POST",
                });
                if (result) {
                  setLink(result.accessUrl);
                  router.refresh();
                }
              }}
            >
              <Icon name="plus" />
              {status.enabled ? "Cấp lại link đăng nhập" : "Cấp quyền cổng khách"}
            </Button>
          )
        }
      />
      <MutationNotice error={mutation.error} message="" />
      <dl className="detail-list">
        <div>
          <dt>Trạng thái</dt>
          <dd>
            <Badge tone={status.enabled ? "success" : "neutral"}>
              {status.enabled ? "Đã cấp quyền" : "Chưa cấp quyền"}
            </Badge>
            {status.createdAt ? ` · từ ${formatDate(status.createdAt)}` : ""}
          </dd>
        </div>
      </dl>
      <p className="panel-body quiet">
        {blocked ||
          "Link chỉ dùng một lần, gửi riêng cho khách; hệ thống không tự gửi email. Email phải chưa có tài khoản nào. Khách chỉ thấy hợp đồng của chính mình, không có quyền quản trị hay thanh toán."}
      </p>
      {link && <OwnerAccessLink
          accessUrl={link}
          recipient="khách thuê"
          onClose={() => setLink(null)}
        />}
    </Panel>
  );
}
