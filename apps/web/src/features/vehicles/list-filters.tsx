"use client";
import type { Branch } from "@rental-fleet/contracts";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import type { DeviceFilters, VehicleFilters } from "./query";
export function ListFilters({
  kind,
  filters,
  branches = [],
  pending,
  onApply,
}: {
  kind: "vehicles" | "devices";
  filters: VehicleFilters | DeviceFilters;
  branches?: Branch[];
  pending: boolean;
  onApply: (values: Record<string, string | number>) => void;
}) {
  return (
    <form
      className="table-toolbar fleet-filters"
      aria-label={kind === "vehicles" ? "Bộ lọc xe" : "Bộ lọc thiết bị"}
      onSubmit={(e) => {
        e.preventDefault();
        const values: Record<string, string | number> = { page: 1 };
        for (const [key, value] of new FormData(e.currentTarget))
          values[key] = String(value);
        onApply(values);
      }}
    >
      <label className="search-input">
        <Icon name="search" />
        <input
          name="search"
          type="search"
          maxLength={100}
          defaultValue={filters.search}
          aria-label={
            kind === "vehicles"
              ? "Tìm biển số, hãng, mẫu xe"
              : "Tìm UID hoặc nhãn thiết bị"
          }
          placeholder={
            kind === "vehicles"
              ? "Tìm biển số, hãng, mẫu xe…"
              : "Tìm UID hoặc nhãn thiết bị…"
          }
        />
      </label>
      <select
        name="status"
        className="filter-select"
        aria-label="Lọc trạng thái"
        defaultValue={filters.status}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="ACTIVE">Hoạt động</option>
        <option value="INACTIVE">Ngưng hoạt động</option>
      </select>
      {kind === "vehicles" ? (
        <select
          name="branchId"
          className="filter-select fleet-branch-filter"
          aria-label="Lọc chi nhánh"
          defaultValue={(filters as VehicleFilters).branchId}
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
              {branch.status === "ACTIVE" ? "" : " (đã vô hiệu hóa)"}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="filter-select"
          name="provider"
          pattern="[A-Za-z0-9][A-Za-z0-9_\-]{0,39}"
          title="Mã nhà cung cấp: chữ, số, gạch nối hoặc gạch dưới, tối đa 40 ký tự."
          maxLength={40}
          placeholder="Nhà cung cấp"
          aria-label="Lọc nhà cung cấp"
          defaultValue={(filters as DeviceFilters).provider}
        />
      )}
      <select
        name="sort"
        className="filter-select"
        aria-label="Sắp xếp theo"
        defaultValue={filters.sort}
      >
        <option value="createdAt">Ngày tạo</option>
        {kind === "vehicles" ? (
          <>
            <option value="licensePlate">Biển số</option>
            <option value="make">Hãng xe</option>
            <option value="model">Mẫu xe</option>
          </>
        ) : (
          <>
            <option value="provider">Nhà cung cấp</option>
            <option value="deviceUid">UID thiết bị</option>
          </>
        )}
      </select>
      <select
        name="order"
        className="filter-select"
        aria-label="Chiều sắp xếp"
        defaultValue={filters.order}
      >
        <option value="desc">Giảm dần</option>
        <option value="asc">Tăng dần</option>
      </select>
      <select
        name="limit"
        className="filter-select"
        aria-label="Số dòng mỗi trang"
        defaultValue={filters.limit}
      >
        <option value="20">20 / trang</option>
        <option value="50">50 / trang</option>
        <option value="100">100 / trang</option>
      </select>
      <Button variant="secondary" type="submit" disabled={pending}>
        {pending ? "Đang tải…" : "Áp dụng"}
      </Button>
    </form>
  );
}
