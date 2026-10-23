import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
export default function NotFound() {
  return (
    <>
      <EmptyState
        icon="business"
        title="Không tìm thấy trang hoặc doanh nghiệp"
        description="Bản ghi không tồn tại trong dữ liệu được cấp quyền xem."
      />
      <Link className="button button-secondary" href="/superadmin/businesses">
        Về danh sách doanh nghiệp
      </Link>
    </>
  );
}
