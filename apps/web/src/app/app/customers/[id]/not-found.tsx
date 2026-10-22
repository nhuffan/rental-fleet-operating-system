import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
export default function NotFound() {
  return (
    <>
      <EmptyState
        title="Không tìm thấy khách hàng"
        description="Bản ghi không tồn tại hoặc không thuộc doanh nghiệp hiện tại."
      />
      <Link className="button button-secondary" href="/app/customers">
        Về danh sách khách hàng
      </Link>
    </>
  );
}
