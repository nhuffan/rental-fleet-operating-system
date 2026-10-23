"use client";
import Link from "next/link";
import { Combobox, FilterBar, SearchField } from "@/components/ui/controls";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import {
  Button,
  Panel,
  PanelHeader,
  RefreshStatus,
} from "@/components/ui/primitives";
import { Pagination } from "@/components/data-display/table";
import { queryString } from "@/lib/query";
import { rentalStatuses, type RentalFilters } from "./query";
import { RentalTable } from "./rental-table";
import type { RentalPage } from "./types";
const names = {
  DRAFT: "Bản nháp",
  RESERVED: "Đã đặt xe",
  ACTIVE: "Đang thuê",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
export function RentalsPanel({
  initial,
  context,
  filters,
}: {
  initial: RentalPage;
  context: Me;
  filters: RentalFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(values: Record<string, string | number>) {
    startTransition(() =>
      router.push(`/app/rentals?${queryString(values)}`, { scroll: false }),
    );
  }
  return (
    <Panel>
      <PanelHeader
        title="Danh sách hợp đồng"
        subtitle={`${initial.total} hợp đồng phù hợp bộ lọc`}
        icon="rental"
        action={
          context.permissions.includes("rental.manage") && (
            <Link className="button button-primary" href="/app/rentals/new">
              Tạo hợp đồng
            </Link>
          )
        }
      />
      <FilterBar
        key={JSON.stringify(filters)}
        busy={pending}
        aria-label="Bộ lọc hợp đồng"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          navigate({
            ...filters,
            page: 1,
            search: String(form.get("search")).trim(),
            status: String(form.get("status")),
            overdue: form.get("overdue") ? "true" : "",
            sort: String(form.get("sort")),
          });
        }}
      >
        <SearchField
          name="search"
          type="search"
          maxLength={100}
          defaultValue={filters.search}
          placeholder="Tên khách, liên hệ hoặc biển số…"
          label="Tìm hợp đồng"
        />
        <Combobox
          name="status"
          label="Trạng thái hợp đồng"
          defaultValue={filters.status}
          options={[
            { value: "", label: "Mọi trạng thái" },
            ...rentalStatuses.map((status) => ({
              value: status,
              label: names[status],
            })),
          ]}
        />
        <Combobox
          name="sort"
          label="Sắp xếp hợp đồng"
          defaultValue={filters.sort}
          options={[
            { value: "createdAt", label: "Ngày tạo" },
            { value: "startAt", label: "Ngày nhận" },
            { value: "endAt", label: "Ngày trả" },
          ]}
        />
        <label className="rental-checkbox">
          <input
            type="checkbox"
            name="overdue"
            defaultChecked={filters.overdue === "true"}
          />
          Quá hạn
        </label>
        <div className="filter-bar-actions">
          <Button type="submit" variant="secondary" loading={pending}>
            Áp dụng
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
        <RentalTable
          rentals={initial.data}
          currency={context.business.currency}
        />
        <Pagination
          disabled={pending}
          {...initial}
          onPage={(page) => navigate({ ...filters, page })}
        />
      </div>
    </Panel>
  );
}
