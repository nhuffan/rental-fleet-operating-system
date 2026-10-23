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
      : "";
  return <LoginForm destination={destination} initialError={initialError} />;
}
