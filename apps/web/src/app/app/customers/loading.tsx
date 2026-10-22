import { Skeleton } from "@/components/ui/primitives";
export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải khách hàng">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-panel" />
      <span className="sr-only">Đang tải dữ liệu khách hàng…</span>
    </div>
  );
}
