"use client";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button, Panel } from "@/components/ui/primitives";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <div className="panel-body" role="alert">
        <h2>Chưa thể tải báo cáo</h2>
        <p>Kiểm tra kết nối hoặc chọn lại kỳ báo cáo rồi thử lại.</p>
        <div className="rental-form-actions">
          <Button onClick={retry}>
            <Icon name="retry" />
            Thử lại
          </Button>
          <Link className="button button-secondary" href="/app/reports">
            Về kỳ mặc định
          </Link>
        </div>
      </div>
    </Panel>
  );
}
