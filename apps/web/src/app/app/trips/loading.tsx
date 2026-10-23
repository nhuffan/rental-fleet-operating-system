import { Skeleton } from "@/components/ui/primitives";
export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải hành trình">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-panel" />
      <span className="sr-only">Đang tải lịch sử GPS…</span>
    </div>
  );
}
