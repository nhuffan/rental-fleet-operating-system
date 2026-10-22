"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { components } from "@rental-fleet/contracts/src/openapi";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
type Schemas = components["schemas"];
export type BusinessUpdate = Schemas["BusinessUpdate"];
export type SettingsUpdate = Schemas["SettingsUpdate"];
export type MemberCreate = Schemas["MemberCreate"];
export type MemberUpdate = Schemas["MemberUpdate"];
export type BranchCreate = Schemas["BranchCreate"];
export type BranchUpdate = Schemas["BranchUpdate"];
type Mutation =
  | { path: "/businesses/current"; body: BusinessUpdate; method?: "PATCH" }
  | { path: "/settings"; body: SettingsUpdate; method?: "PATCH" }
  | { path: "/memberships"; body: MemberCreate; method: "POST" }
  | { path: `/memberships/${string}`; body: MemberUpdate; method?: "PATCH" }
  | { path: "/branches"; body: BranchCreate; method: "POST" }
  | { path: `/branches/${string}`; body: BranchUpdate; method?: "PATCH" };
export function useMutation(businessId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function mutate({ path, body, method = "PATCH" }: Mutation) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const {
        data: { session },
      } = await browserClient().auth.getSession();
      if (!session) {
        router.replace("/login");
        return false;
      }
      const response = await fetch(`${publicEnv().api}/api/v1${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Business-Id": businessId,
        },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        router.replace("/login");
        return false;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages: Record<string, string> = {
          LAST_OWNER: "Doanh nghiệp phải có ít nhất một Owner hoạt động.",
          ROLE_CHANGE_DENIED:
            "Chỉ Owner được quản lý vai trò Admin hoặc Owner.",
          USER_NOT_FOUND:
            "Không tìm thấy tài khoản Auth. Hãy kiểm tra User ID đã được tạo.",
          MEMBERSHIP_EXISTS:
            "Thành viên đã tồn tại. Hãy chỉnh sửa thành viên hiện tại.",
        };
        setError(
          messages[payload.code] ??
            (response.status === 403
              ? "Bạn không có quyền thực hiện thao tác này."
              : `Không thể lưu (${payload.code ?? response.status}). Mã yêu cầu: ${payload.requestId ?? "—"}`),
        );
        return false;
      }
      setMessage("Đã lưu thay đổi.");
      router.refresh();
      return true;
    } catch {
      setError("Không thể kết nối API. Vui lòng thử lại.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    message,
    mutate,
    clear: () => {
      setError("");
      setMessage("");
    },
  };
}
