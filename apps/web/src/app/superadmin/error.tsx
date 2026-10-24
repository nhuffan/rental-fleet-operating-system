"use client";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { Button, ErrorState, Panel } from "@/components/ui/primitives";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <ErrorState
        message="Không thể tải dữ liệu nền tảng. Kiểm tra kết nối hoặc khoảng thời gian lọc và thử lại."
        action={
          <div className="inline">
            <Button onClick={retry}>
              <Icon name="retry" />
              Thử lại
            </Button>
            <Link className="button button-secondary" href="/superadmin">
              Về tổng quan
            </Link>
          </div>
        }
      />
    </Panel>
  );
}
