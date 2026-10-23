"use client";
import type { Branch } from "@rental-fleet/contracts";
import { Button, FormField, Input } from "@/components/ui/primitives";
import { Combobox, FilterBar, SearchField } from "@/components/ui/controls";
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
    <FilterBar
      key={JSON.stringify(filters)}
      aria-label={kind === "vehicles" ? "Bộ lọc xe" : "Bộ lọc thiết bị"}
      busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const values: Record<string, string | number> = { page: 1 };
        for (const [key, value] of new FormData(event.currentTarget))
          values[key] = String(value).trim();
        onApply(values);
      }}
    >
      <SearchField
        name="search"
        label={kind === "vehicles" ? "Tìm xe" : "Tìm thiết bị"}
        maxLength={100}
        defaultValue={filters.search}
        placeholder={
          kind === "vehicles"
            ? "Biển số, hãng hoặc mẫu xe…"
            : "UID hoặc nhãn thiết bị…"
        }
      />
      <Combobox
        label="Trạng thái"
        name="status"
        defaultValue={filters.status}
        options={[
          { value: "", label: "Tất cả trạng thái" },
          { value: "ACTIVE", label: "Hoạt động" },
          { value: "INACTIVE", label: "Ngưng hoạt động" },
        ]}
      />
      {kind === "vehicles" ? (
        <Combobox
          label="Chi nhánh"
          name="branchId"
          searchable
          defaultValue={(filters as VehicleFilters).branchId}
          options={[
            { value: "", label: "Tất cả chi nhánh" },
            ...branches.map((branch) => ({
              value: branch.id,
              label: `${branch.name}${branch.status === "ACTIVE" ? "" : " (đã vô hiệu hóa)"}`,
            })),
          ]}
        />
      ) : (
        <FormField id="device-provider-filter" label="Nhà cung cấp">
          <Input
            id="device-provider-filter"
            name="provider"
            pattern="[A-Za-z0-9][A-Za-z0-9_\-]{0,39}"
            title="Mã nhà cung cấp: chữ, số, gạch nối hoặc gạch dưới, tối đa 40 ký tự."
            maxLength={40}
            placeholder="Tất cả nhà cung cấp"
            defaultValue={(filters as DeviceFilters).provider}
          />
        </FormField>
      )}
      <Combobox
        label="Sắp xếp theo"
        name="sort"
        defaultValue={filters.sort}
        options={[
          { value: "createdAt", label: "Ngày tạo" },
          ...(kind === "vehicles"
            ? [
                { value: "licensePlate", label: "Biển số" },
                { value: "make", label: "Hãng xe" },
                { value: "model", label: "Mẫu xe" },
              ]
            : [
                { value: "provider", label: "Nhà cung cấp" },
                { value: "deviceUid", label: "UID thiết bị" },
              ]),
        ]}
      />
      <Combobox
        label="Chiều sắp xếp"
        name="order"
        defaultValue={filters.order}
        options={[
          { value: "desc", label: "Giảm dần" },
          { value: "asc", label: "Tăng dần" },
        ]}
      />
      <Combobox
        label="Mỗi trang"
        name="limit"
        defaultValue={filters.limit}
        options={[20, 50, 100].map((value) => ({
          value: String(value),
          label: `${value} / trang`,
        }))}
      />
      <div className="filter-bar-actions">
        <Button variant="secondary" type="submit" loading={pending}>
          {pending ? "Đang tải…" : "Áp dụng"}
        </Button>
        <Button
          variant="ghost"
          type="button"
          disabled={pending}
          onClick={(event) => {
            event.currentTarget.form?.reset();
            onApply({ page: 1 });
          }}
        >
          Xóa bộ lọc
        </Button>
      </div>
    </FilterBar>
  );
}
