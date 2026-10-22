import { Skeleton } from "@/components/ui/primitives";
export default function FleetLoading() {
  return (
    <div role="status" aria-label="Đang tải đội xe">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-panel" />
      <span className="sr-only">Đang tải dữ liệu đội xe…</span>
    </div>
  );
}
