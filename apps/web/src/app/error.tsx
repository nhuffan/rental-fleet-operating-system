"use client";
import { Button, Panel } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

// A parent boundary catches workspace-layout failures before AppShell can load.
export default function WorkspaceError({ retry }: { retry: () => void }) {
  return (
    <main className="standalone">
      <Panel>
        <div className="panel-body" role="alert">
          <h1>Chưa thể mở không gian làm việc</h1>
          <p>
            Dịch vụ chưa sẵn sàng hoặc kết nối bị gián đoạn. Vui lòng thử lại
            sau ít phút.
          </p>
          <Button type="button" onClick={retry}>
            <Icon name="retry" />
            Thử lại
          </Button>
        </div>
      </Panel>
    </main>
  );
}
