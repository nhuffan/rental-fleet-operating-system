"use client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/form-dialog";
import { Button, Notice } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

// The credential is held only by the caller's transient component state.
export function OwnerAccessLink({
  accessUrl,
  onClose,
  recipient = "Owner",
}: {
  accessUrl: string;
  onClose: () => void;
  recipient?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  return (
    <ConfirmDialog
      title={`Link đăng nhập cho ${recipient}`}
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          <Icon name="check" />
          Đã gửi
        </Button>
      }
    >
      <Notice tone="warning">
        Chỉ hiển thị một lần — gửi riêng cho {recipient}. Người có link có thể đặt mật
        khẩu cho tài khoản.
      </Notice>
      <p className="quiet">
        Link chỉ dùng một lần và có thời hạn. Đóng hộp thoại sẽ xóa link khỏi
        màn hình; bạn có thể cấp lại nếu cần.
      </p>
      <p
        className="platform-access-credential"
        aria-label={`Link đặt mật khẩu cho ${recipient}`}
      >
        {accessUrl}
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          setCopyError(false);
          try {
            await navigator.clipboard.writeText(accessUrl);
            setCopied(true);
          } catch {
            setCopyError(true);
          }
        }}
      >
        <Icon name={copied ? "check" : "rental"} />
        {copied ? "Đã sao chép" : "Sao chép link"}
      </Button>
      {copyError && (
        <Notice tone="danger">
          Không thể sao chép tự động. Chọn toàn bộ link phía trên và sao chép
          thủ công.
        </Notice>
      )}
      <p role="status" className="sr-only">
        {copied
          ? "Đã sao chép link. Gửi riêng cho người nhận qua kênh bạn chọn."
          : ""}
      </p>
    </ConfirmDialog>
  );
}
