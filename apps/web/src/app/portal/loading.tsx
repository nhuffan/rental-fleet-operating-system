import { LoadingState } from "@/components/ui/primitives";

export default function Loading() {
  return <LoadingState variant="dashboard" statCount={3} label="Đang tải hợp đồng…" />;
}
