"use client";
import { Button, Panel } from "@/components/ui/primitives";
export default function FleetError({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <div className="panel-body" role="alert">
        <h2>Không thể tải dữ liệu đội xe</h2>
        <p>Vui lòng kiểm tra kết nối và thử tải lại.</p>
        <Button onClick={retry}>Thử lại</Button>
      </div>
    </Panel>
  );
}
