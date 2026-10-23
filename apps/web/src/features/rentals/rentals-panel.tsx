"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
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
    startTransition(() => router.push(`/app/rentals?${queryString(values)}`));
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
      <form
        className="table-toolbar fleet-filters"
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
        <label className="search-input">
          <input
            name="search"
            type="search"
            maxLength={100}
            defaultValue={filters.search}
            placeholder="Tên khách, liên hệ hoặc biển số…"
            aria-label="Tìm hợp đồng"
          />
        </label>
        <select
          name="status"
          className="filter-select"
          aria-label="Trạng thái hợp đồng"
          defaultValue={filters.status}
        >
          <option value="">Mọi trạng thái</option>
          {rentalStatuses.map((status) => (
            <option value={status} key={status}>
              {names[status]}
            </option>
          ))}
        </select>
        <select
          name="sort"
          className="filter-select"
          aria-label="Sắp xếp hợp đồng"
          defaultValue={filters.sort}
        >
          <option value="createdAt">Ngày tạo</option>
          <option value="startAt">Ngày nhận</option>
          <option value="endAt">Ngày trả</option>
        </select>
        <label className="rental-checkbox">
          <input
            type="checkbox"
            name="overdue"
            defaultChecked={filters.overdue === "true"}
          />
          Quá hạn
        </label>
        <Button type="submit" variant="secondary" disabled={pending}>
          Áp dụng
        </Button>
      </form>
      <div aria-busy={pending}>
        <RentalTable
          rentals={initial.data}
          currency={context.business.currency}
        />
        <Pagination
          {...initial}
          onPage={(page) => navigate({ ...filters, page })}
        />
      </div>
    </Panel>
  );
}
