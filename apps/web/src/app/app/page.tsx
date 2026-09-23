import Link from "next/link";
import { currentContext } from "@/lib/api";
export default async function Dashboard() {
  const c = await currentContext();
  return (
    <>
      <span className="eyebrow">KHÔNG GIAN LÀM VIỆC</span>
      <h1>Xin chào, {c.user.displayName || "bạn"}.</h1>
      <p className="muted">
        Quản lý thông tin doanh nghiệp, chi nhánh và quyền truy cập của đội ngũ.
      </p>
      <div className="cards">
        <Link className="card" href="/app/business">
          <span className="eyebrow">DOANH NGHIỆP</span>
          <h2>{c.business.name}</h2>
          <p>
            {c.business.timezone} · {c.business.currency}
          </p>
          <span>Xem thông tin →</span>
        </Link>
        <Link className="card" href="/app/branches">
          <span className="eyebrow">VẬN HÀNH</span>
          <h2>Chi nhánh</h2>
          <p>Danh sách điểm vận hành của doanh nghiệp.</p>
          <span>Quản lý chi nhánh →</span>
        </Link>
      </div>
      <section className="card">
        <h2>Nền tảng vận hành</h2>
        <p className="muted">
          Các chức năng quản lý xe và hợp đồng thuê sẽ được bổ sung trong phiên
          bản tiếp theo.
        </p>
      </section>
    </>
  );
}
