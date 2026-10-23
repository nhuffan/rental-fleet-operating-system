import { Logout } from "../app/shell-controls";
import Link from "next/link";
export default async function AccessDenied({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const platform = (await searchParams).scope === "platform";
  return (
    <main className="standalone">
      <span className="eyebrow">
        QUYỀN TRUY CẬP{platform ? " NỀN TẢNG" : ""}
      </span>
      <h1>Bạn chưa có quyền truy cập{platform ? " nền tảng" : ""}.</h1>
      <p>
        {platform
          ? "Tài khoản cần quyền platform operator đang hoạt động. Vai trò OWNER/ADMIN của doanh nghiệp không cấp quyền này. Hãy liên hệ quản trị nền tảng."
          : "Doanh nghiệp hoặc membership có thể chưa được kích hoạt. Hãy liên hệ quản trị viên."}
      </p>
      <div className="inline">
        <Link href={platform ? "/superadmin" : "/app"}>Thử lại</Link>
        {platform && <Link href="/app">Về không gian doanh nghiệp</Link>}
      </div>
      <Logout />
    </main>
  );
}
