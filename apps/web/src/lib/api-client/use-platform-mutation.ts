"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import type { PlatformBusinessCreate } from "@/features/platform/live/types";

type PlatformMutation =
  | {
      path: "/platform/businesses";
      method: "POST";
      body: PlatformBusinessCreate;
    }
  | {
      path: `/platform/businesses/${string}/owner-links`;
      method: "POST";
      body: { membershipId: string };
    }
  | {
      path: `/platform/businesses/${string}/status`;
      method: "PATCH";
      body: { status: "ACTIVE" | "DISABLED" };
    };
const messages: Record<string, string> = {
  PLATFORM_ACCESS_DENIED: "Bạn không có quyền thực hiện thao tác nền tảng này.",
  PLATFORM_BUSINESS_NOT_FOUND:
    "Không tìm thấy doanh nghiệp. Vui lòng tải lại dữ liệu.",
  PLATFORM_OWNER_NOT_FOUND:
    "Owner không còn quyền truy cập hoạt động trong doanh nghiệp này.",
  PLATFORM_OWNER_UNAVAILABLE:
    "Không thể cấp link cho Owner đang bị vô hiệu hóa.",
  PLATFORM_BUSINESS_DISABLED:
    "Kích hoạt doanh nghiệp trước khi cấp link cho Owner.",
  PLATFORM_AUTH_UNAVAILABLE: "Chưa thể cấp link đăng nhập. Vui lòng thử lại.",
  PLATFORM_OWNER_DISABLED:
    "Hồ sơ Owner đang bị vô hiệu hóa. Không thể cấp quyền truy cập.",
  VALIDATION_ERROR: "Kiểm tra lại thông tin đã nhập trước khi tiếp tục.",
};

// Same mutation lifecycle as tenant forms, with independent platform auth and no business header.
export function usePlatformMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function mutateResult<T>({
    path,
    method,
    body,
  }: PlatformMutation): Promise<T | null> {
    setBusy(true);
    setError("");
    try {
      const {
        data: { session },
      } = await browserClient().auth.getSession();
      if (!session) {
        router.replace("/login");
        return null;
      }
      const response = await fetch(`${publicEnv().api}/api/v1${path}`, {
        method,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        router.replace("/login");
        return null;
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          messages[payload?.code] ??
            "Thao tác chưa hoàn tất. Vui lòng kiểm tra dữ liệu và thử lại.",
        );
        return null;
      }
      return payload as T;
    } catch {
      setError(
        "Kết nối bị gián đoạn. Kiểm tra lại danh sách trước khi thử lại để tránh tạo trùng doanh nghiệp.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, mutateResult, clear: () => setError("") };
}
