"use client";
import Link from "next/link";
import { Combobox, FilterBar, SearchField } from "@/components/ui/controls";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Panel,
  PanelHeader,
  RefreshStatus,
  Badge,
  EmptyState,
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
      router.push(`/superadmin/businesses?${queryString(values)}`, {
        scroll: false,
      }),
    );
  }
  return (
    <Panel className="tenant-health">
      <PanelHeader
        title="Danh sách doanh nghiệp"
        subtitle={`${initial.total} doanh nghiệp phù hợp · Dữ liệu trực tiếp, chỉ đọc`}
        icon="business"
      />
      <FilterBar
        key={JSON.stringify(filters)}
        busy={pending}
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
        <SearchField
          type="search"
          name="search"
          maxLength={120}
          defaultValue={filters.search}
          placeholder="Tìm tên doanh nghiệp…"
          label="Tìm doanh nghiệp"
        />
        <Combobox
          name="status"
          label="Trạng thái doanh nghiệp"
          defaultValue={filters.status}
          options={[
            { value: "", label: "Mọi trạng thái" },
            { value: "ACTIVE", label: "Hoạt động" },
            { value: "DISABLED", label: "Đã vô hiệu hóa" },
          ]}
        />
        <Combobox
          name="sort"
          label="Sắp xếp doanh nghiệp"
          defaultValue={filters.sort}
          options={[
            { value: "createdAt", label: "Ngày tạo" },
            { value: "name", label: "Tên doanh nghiệp" },
          ]}
        />
        <Combobox
          name="order"
          label="Chiều sắp xếp"
          defaultValue={filters.order}
          options={[
            { value: "desc", label: "Giảm dần" },
            { value: "asc", label: "Tăng dần" },
          ]}
        />
        <Combobox
          name="limit"
          label="Mỗi trang"
          defaultValue={filters.limit}
          options={[20, 50, 100].map((value) => ({
            value: String(value),
            label: `${value} / trang`,
          }))}
        />
        <div className="filter-bar-actions">
          <Button type="submit" variant="secondary" loading={pending}>
            {pending ? "Đang tải…" : "Áp dụng"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={pending}
            onClick={(event) => {
              event.currentTarget.form?.reset();
              navigate({ page: 1 });
            }}
          >
            Xóa bộ lọc
          </Button>
        </div>
      </FilterBar>
      <div className="pending-region" aria-busy={pending}>
        <RefreshStatus pending={pending} />
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
                label: "Owner",
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
          disabled={pending}
          {...initial}
          onPage={(page) => navigate({ ...filters, page })}
        />
      </div>
      <p className="panel-body quiet">
        Owner được đếm theo liên kết với doanh nghiệp, không phải số tài khoản
        duy nhất trên toàn nền tảng. GPS luôn là TEST feed; trạng thái đăng ký
        thiết bị không đồng nghĩa có tín hiệu.
      </p>
    </Panel>
  );
}
