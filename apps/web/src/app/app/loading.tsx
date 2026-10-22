import { Skeleton } from "@/components/ui/primitives";
export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải dữ liệu">
      <Skeleton className="skeleton-title" />
      <div className="core-grid">
        <Skeleton className="skeleton-panel" />
        <Skeleton className="skeleton-panel" />
      </div>
      <span className="sr-only">Đang tải dữ liệu…</span>
    </div>
  );
}
