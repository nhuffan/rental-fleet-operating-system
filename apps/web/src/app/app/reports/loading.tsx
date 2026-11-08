import { LoadingState } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <LoadingState variant="dashboard" statCount={4} label="Đang tải báo cáo…" />
  );
}
