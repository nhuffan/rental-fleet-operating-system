import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
export default function NotFound() {
  return (
    <>
      <EmptyState
        icon="trip"
        title="Không tìm thấy dữ liệu tra cứu"
        description="Xe, hợp đồng hoặc hành trình không tồn tại trong doanh nghiệp hiện tại. Hãy chọn lại bộ lọc."
      />
      <Link className="button button-secondary" href="/app/trips">
        Về danh sách hành trình
      </Link>
    </>
  );
}
