"use client";
import { useParams } from "next/navigation";
import { tripHistoryHref } from "@/features/telematics/trips/query";
import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
export default function NotFound() {
  const params = useParams();
  const href = tripHistoryHref(params.id);
  return (
    <>
      <EmptyState
        icon="trip"
        title="Không tìm thấy hành trình"
        description="Bản ghi không thuộc doanh nghiệp hiện tại, hoặc kết quả đã thay đổi do nhận bản tin trễ hay hết hạn lưu trữ. Hãy tra cứu lại danh sách."
      />
      <Link className="button button-secondary" href={href}>
        Tra cứu lại lịch sử đã lọc
      </Link>
    </>
  );
}
