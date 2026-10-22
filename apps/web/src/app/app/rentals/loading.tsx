import { Skeleton } from "@/components/ui/primitives";
export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải hợp đồng">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-panel" />
      <span className="sr-only">Đang tải dữ liệu hợp đồng…</span>
    </div>
  );
}
