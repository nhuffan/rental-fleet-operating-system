"use client";
import Link from "next/link";
import { Button, Panel } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <div className="panel-body" role="alert">
        <h2>Chưa tải được đối soát phí đường bộ</h2>
        <p>Kiểm tra kết nối và bộ lọc rồi thử lại.</p>
        <div className="rental-form-actions">
          <Button onClick={retry}>
            <Icon name="retry" />
            Thử lại
          </Button>
          <Link
            className="button button-secondary"
            href="/app/commercial/tolls"
          >
            Xóa bộ lọc
          </Link>
        </div>
      </div>
    </Panel>
  );
}
