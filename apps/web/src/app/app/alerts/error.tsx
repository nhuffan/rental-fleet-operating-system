"use client";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { Button, Panel } from "@/components/ui/primitives";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <div className="panel-body" role="alert">
        <h2>Chưa thể tải cảnh báo</h2>
        <p>Kiểm tra kết nối hoặc bỏ bộ lọc xe/hợp đồng rồi thử lại.</p>
        <div className="rental-form-actions">
          <Button onClick={retry}>
            <Icon name="retry" />
            Thử lại
          </Button>
          <Link className="button button-secondary" href="/app/alerts">
            Xóa bộ lọc
          </Link>
        </div>
      </div>
    </Panel>
  );
}
