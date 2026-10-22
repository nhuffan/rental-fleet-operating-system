import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
export default function MissingVehicle() {
  return (
    <>
      <EmptyState
        title="Không tìm thấy xe"
        description="Xe không tồn tại hoặc không thuộc doanh nghiệp hiện tại."
        icon="car"
      />
      <Link href="/app/vehicles" className="button button-secondary">
        Về danh sách xe
      </Link>
    </>
  );
}
