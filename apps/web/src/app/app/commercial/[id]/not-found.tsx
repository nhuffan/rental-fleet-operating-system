import Link from "next/link";
import { EmptyState, Panel } from "@/components/ui/primitives";
export default function NotFound() {
  return (
    <Panel>
      <EmptyState
        title="Không tìm thấy giao dịch"
        description="Giao dịch không có trong doanh nghiệp hiện tại hoặc liên kết không hợp lệ."
        icon="wallet"
      />
      <div className="panel-body">
        <Link className="button button-secondary" href="/app/commercial">
          Về sổ giao dịch
        </Link>
      </div>
    </Panel>
  );
}
