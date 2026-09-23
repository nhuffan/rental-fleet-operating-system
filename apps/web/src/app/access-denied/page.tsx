import { Logout } from "../app/shell-controls";
import Link from "next/link";
export default function AccessDenied() {
  return (
    <main className="standalone">
      <span className="eyebrow">QUYỀN TRUY CẬP</span>
      <h1>Bạn chưa có quyền truy cập.</h1>
      <p>
        Doanh nghiệp hoặc membership có thể chưa được kích hoạt. Hãy liên hệ
        quản trị viên.
      </p>
      <Link href="/app">Thử lại</Link>
      <Logout />
    </main>
  );
}
