"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Panel,
  PanelHeader,
  Badge,
  EmptyState,
  Input,
  Select,
  StatusBadge,
} from "@/components/ui/primitives";
import { DataTable, Pagination } from "@/components/data-display/table";
import { formatDate, queryString } from "@/lib/query";
import type { BusinessFilters } from "./query";
import type { PlatformBusinessPage } from "./types";
export function BusinessesPanel({
  initial,
  filters,
}: {
  initial: PlatformBusinessPage;
  filters: BusinessFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(values: Record<string, string | number>) {
    startTransition(() =>
      router.push(`/superadmin/businesses?${queryString(values)}`),
    );
  }
  return (
    <Panel className="tenant-health">
      <PanelHeader
        title="Danh sách doanh nghiệp"
        subtitle={`${initial.total} doanh nghiệp phù hợp · Dữ liệu trực tiếp, chỉ đọc`}
        icon="business"
      />
      <form
        className="table-toolbar fleet-filters"
        aria-label="Bộ lọc doanh nghiệp nền tảng"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          navigate({
            ...filters,
            page: 1,
            search: String(form.get("search")).trim(),
            status: String(form.get("status")),
            sort: String(form.get("sort")),
            order: String(form.get("order")),
            limit: String(form.get("limit")),
          });
        }}
      >
        <label className="search-input">
          <Input
            type="search"
            name="search"
            maxLength={120}
            defaultValue={filters.search}
            placeholder="Tìm tên doanh nghiệp…"
            aria-label="Tìm doanh nghiệp"
          />
        </label>
        <Select
          className="filter-select"
          name="status"
          defaultValue={filters.status}
          aria-label="Trạng thái doanh nghiệp"
        >
          <option value="">Mọi trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="DISABLED">Đã vô hiệu hóa</option>
        </Select>
        <Select
          className="filter-select"
          name="sort"
          defaultValue={filters.sort}
          aria-label="Sắp xếp doanh nghiệp"
        >
          <option value="createdAt">Ngày tạo</option>
          <option value="name">Tên doanh nghiệp</option>
        </Select>
        <Select
          className="filter-select"
          name="order"
          defaultValue={filters.order}
          aria-label="Chiều sắp xếp"
        >
          <option value="desc">Giảm dần</option>
          <option value="asc">Tăng dần</option>
        </Select>
        <Select
          className="filter-select"
          name="limit"
          defaultValue={filters.limit}
          aria-label="Số doanh nghiệp mỗi trang"
        >
          <option value="20">20 / trang</option>
          <option value="50">50 / trang</option>
          <option value="100">100 / trang</option>
        </Select>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Đang tải…" : "Áp dụng"}
        </Button>
      </form>
      <div aria-busy={pending}>
        {initial.data.length ? (
          <DataTable
            caption="Doanh nghiệp nền tảng từ API được phân quyền"
            rows={initial.data}
            columns={[
              {
                key: "name",
                label: "Doanh nghiệp",
                render: (b) => (
                  <Link
                    href={`/superadmin/businesses/${b.id}`}
                    className="tenant-name fleet-record-link"
                  >
                    <strong>{b.name}</strong>
                    <small>
                      {b.timezone} · {b.currency}
                    </small>
                  </Link>
                ),
              },
              {
                key: "status",
                label: "Trạng thái",
                render: (b) => <StatusBadge status={b.status} />,
              },
              {
                key: "branches",
                label: "Chi nhánh",
                render: (b) => (
                  <>
                    {b.counts.activeBranches} / {b.counts.branches}
                    <small>đang hoạt động / tổng</small>
                  </>
                ),
              },
              {
                key: "members",
                label: "Memberships",
                render: (b) => (
                  <>
                    {b.counts.activeMemberships} / {b.counts.memberships}
                    <small>đang hoạt động / tổng</small>
                  </>
                ),
              },
              {
                key: "fleet",
                label: "Đội xe / đang thuê",
                render: (b) => (
                  <>
                    {b.counts.vehicles} xe
                    <small>{b.counts.activeRentals} hợp đồng đang thuê</small>
                  </>
                ),
              },
              {
                key: "gps",
                label: "GPS TEST",
                render: (b) => (
                  <>
                    <Badge tone={b.gps.FRESH ? "success" : "neutral"}>
                      {b.gps.FRESH} mới
                    </Badge>
                    <small>
                      {b.gps.STALE} trễ · {b.gps.OFFLINE} mất kết nối
                    </small>
                    <small>
                      {b.gps.NO_DATA} chưa có data · {b.gps.UNASSIGNED} chưa gắn
                    </small>
                  </>
                ),
              },
              {
                key: "created",
                label: "Ngày tạo (VN)",
                render: (b) => formatDate(b.createdAt),
              },
            ]}
          />
        ) : (
          <EmptyState
            title="Không có doanh nghiệp phù hợp"
            description="Thử thay đổi tên hoặc trạng thái trong bộ lọc."
            icon="business"
          />
        )}
        <Pagination
          {...initial}
          onPage={(page) => navigate({ ...filters, page })}
        />
      </div>
      <p className="panel-body quiet">
        Memberships là số liên kết người dùng với doanh nghiệp, không phải số
        tài khoản duy nhất trên toàn nền tảng. GPS luôn là TEST feed; trạng thái
        đăng ký thiết bị không đồng nghĩa có tín hiệu.
      </p>
    </Panel>
  );
}
