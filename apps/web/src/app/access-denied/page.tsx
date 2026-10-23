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
          ? "Tài khoản cần quyền Superadmin đang hoạt động. Owner chỉ có quyền trong doanh nghiệp. Hãy liên hệ quản trị nền tảng."
          : "Không gian doanh nghiệp chỉ dành cho Owner đang hoạt động. Tài khoản có thể chưa được cấp quyền hoặc đã bị vô hiệu hóa. Cổng khách thuê xe chưa được triển khai."}
      </p>
      <div className="inline">
        <Link href={platform ? "/superadmin" : "/app"}>Thử lại</Link>
        {platform && <Link href="/app">Về không gian doanh nghiệp</Link>}
      </div>
      <Logout />
    </main>
  );
}
