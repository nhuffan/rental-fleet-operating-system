"use client";
import Link from "next/link";
import { Button, Panel } from "@/components/ui/primitives";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <div className="panel-body" role="alert">
        <h2>Không thể tải dữ liệu thương mại</h2>
        <p>Kiểm tra kết nối, khoảng ngày và liên kết bộ lọc rồi thử lại.</p>
        <div className="rental-form-actions">
          <Button onClick={retry}>Thử lại</Button>
          <Link className="button button-secondary" href="/app/commercial">
            Xóa bộ lọc
          </Link>
        </div>
      </div>
    </Panel>
  );
}
