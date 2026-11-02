import { safeReturnPath } from "@/lib/auth-navigation";
import { LoginForm } from "./login-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string }>;
}) {
  const params = await searchParams;
  const destination = safeReturnPath(params.next, "") || null;
  const initialError =
    params.error === "workspace_unavailable"
      ? "Không thể xác minh quyền truy cập. Vui lòng thử đăng nhập lại."
      : params.error === "link_invalid"
        ? "Link không hợp lệ, đã dùng hoặc đã hết hạn. Liên hệ quản trị viên để được cấp lại."
        : "";
  return <LoginForm destination={destination} initialError={initialError} />;
}
