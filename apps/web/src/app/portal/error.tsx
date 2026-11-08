"use client";
import { Icon } from "@/components/ui/icon";
import { Button, Panel } from "@/components/ui/primitives";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <div className="panel-body" role="alert">
        <h2>Chưa thể tải dữ liệu</h2>
        <p>Kiểm tra kết nối rồi thử lại. Nếu vẫn lỗi, liên hệ doanh nghiệp cho thuê xe.</p>
        <Button onClick={retry}>
          <Icon name="retry" />
          Thử lại
        </Button>
      </div>
    </Panel>
  );
}
