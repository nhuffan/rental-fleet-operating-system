import { Skeleton } from "@/components/ui/primitives";
export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải nền tảng">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-panel" />
      <span className="sr-only">Đang tải dữ liệu nền tảng…</span>
    </div>
  );
}
