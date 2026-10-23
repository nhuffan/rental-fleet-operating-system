"use client";
import { Button, Panel } from "@/components/ui/primitives";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <div className="panel-body" role="alert">
        <h2>Không thể tải dữ liệu nền tảng</h2>
        <p>
          Kiểm tra kết nối và thử lại. Không có dữ liệu minh họa được dùng thay
          thế.
        </p>
        <Button onClick={retry}>Thử lại</Button>
      </div>
    </Panel>
  );
}
