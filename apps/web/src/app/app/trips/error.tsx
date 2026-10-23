"use client";
import Link from "next/link";
import { Button, Panel } from "@/components/ui/primitives";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <Panel>
      <div className="panel-body" role="alert">
        <h2>Không thể tải lịch sử hành trình</h2>
        <p>
          Kiểm tra kết nối và thử lại. Nếu khoảng tra cứu có quá nhiều điểm GPS,
          hãy chọn ít ngày hơn hoặc chọn một xe.
        </p>
        <div className="inline">
          <Button onClick={retry}>Thử lại</Button>
          <Link className="button button-secondary" href="/app/trips">
            Chọn lại bộ lọc
          </Link>
        </div>
      </div>
    </Panel>
  );
}
