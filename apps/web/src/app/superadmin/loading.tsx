"use client";
import { usePathname } from "next/navigation";
import { LoadingState } from "@/components/ui/primitives";
export default function Loading() {
  const path = usePathname();
  const variant =
    path === "/superadmin"
      ? "dashboard"
      : /^\/superadmin\/(businesses|users)\/[^/]+/.test(path)
        ? "detail"
        : "list";
  return (
    <LoadingState
      variant={variant}
      statCount={variant === "dashboard" ? 4 : 3}
      label="Đang tải dữ liệu nền tảng…"
    />
  );
}
