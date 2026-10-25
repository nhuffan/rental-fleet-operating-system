"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import {
  Badge,
  Button,
  Input,
  Panel,
  PanelHeader,
  RefreshStatus,
} from "@/components/ui/primitives";
import { Combobox, DateInput, FilterBar } from "@/components/ui/controls";
import { FormDialog, DialogActions } from "@/components/ui/form-dialog";
import { RecordPicker } from "@/components/data-display/record-picker";
import { DataTable, Pagination } from "@/components/data-display/table";
import { Icon } from "@/components/ui/icon";
import type { Vehicle } from "@/features/fleet/vehicles/types";
import { formatDate, queryString } from "@/lib/query";
import { commercialMoney } from "../query";
import { bulkRecordable, tollStatuses, tollStatusLabels } from "./policy";
import { TollImportDialog } from "./import-dialog";
import { TollBulkDialog, TollReviewDialog } from "./review-dialog";
import type { TollFilters } from "./query";
import type { TollPage } from "./types";
export function TollPanel({
  initial,
  context,
  filters,
}: {
  initial: TollPage;
  context: Me;
  filters: TollFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"import" | "bulk" | "vehicle" | null>(
    null,
  );
  const [review, setReview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [selected, setSelected] = useState<{
    scope: string;
    rows: { id: string; version: number }[];
  }>({ scope: "", rows: [] });
  const scope = `${context.business.id}:${JSON.stringify(filters)}`;
  const selection = selected.scope === scope ? selected.rows : [];
  const selectedRows = initial.data.filter(
    (item) =>
      selection.some(
        (value) => value.id === item.id && value.version === item.version,
      ) && bulkRecordable(item),
  );
  const canManage = context.permissions.includes("commercial.manage");
  function navigate(next: Record<string, string | number>) {
    setSelected({ scope: "", rows: [] });
    startTransition(() =>
      router.push(`/app/commercial/tolls?${queryString(next)}`, {
        scroll: false,
      }),
    );
  }
  function saved(value: string) {
    setMessage(value);
    setSelected({ scope: "", rows: [] });
    startTransition(() => router.refresh());
  }
  return (
    <>
      {message && (
        <p className="notice notice-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}
      <Panel>
        <div className="panel-body">
          <div className="toll-toolbar">
            <div>
              <strong>CSV do doanh nghiệp cung cấp · Không đồng bộ VETC</strong>
              <p className="quiet">
                Import tạo dòng cần đối soát, chưa ghi khoản chi. Gợi ý xe/hợp
                đồng không chứng minh người thuê chịu phí. CSV không là chứng từ
                thanh toán độc lập.
              </p>
            </div>
            {canManage && (
              <Button
                type="button"
                disabled={pending}
                onClick={() => setDialog("import")}
              >
                <Icon name="plus" />
                Nhập CSV
              </Button>
            )}
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelHeader
          title="Danh sách đối soát phí đường bộ"
          subtitle={`${initial.total} dòng phù hợp · VND nguyên đồng`}
          icon="wallet"
          action={
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              onClick={() => startTransition(() => router.refresh())}
            >
              <Icon name="retry" />
              Làm mới
            </Button>
          }
        />
        <FilterBar
          key={JSON.stringify(filters)}
          busy={pending}
          aria-label="Bộ lọc phí đường bộ"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget),
              from = String(data.get("from") ?? ""),
              until = String(data.get("until") ?? "");
            if (from && until && from > until) {
              setError("Ngày bắt đầu phải trước hoặc cùng ngày kết thúc.");
              return;
            }
            setError("");
            navigate({
              ...filters,
              page: 1,
              from,
              until,
              status: String(data.get("status") ?? ""),
            });
          }}
        >
          <Combobox
            name="status"
            label="Trạng thái"
            defaultValue={filters.status}
            options={[
              { value: "", label: "Mọi trạng thái" },
              ...tollStatuses.map((status) => ({
                value: status,
                label: tollStatusLabels[status],
              })),
            ]}
          />
          <label className="form-field">
            Từ ngày (VN)
            <DateInput name="from" defaultValue={filters.from} />
          </label>
          <label className="form-field">
            Đến hết ngày (VN)
            <DateInput name="until" defaultValue={filters.until} />
          </label>
          <div className="filter-actions">
            <Button type="submit">
              <Icon name="search" />
              Lọc
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setVehicle(filters.vehicleId);
                setDialog("vehicle");
              }}
            >
              <Icon name="car" />
              {filters.vehicleId
                ? `Xe #${filters.vehicleId.slice(0, 8)}`
                : "Chọn xe"}
            </Button>
            <Button
              type="reset"
              variant="ghost"
              onClick={() => {
                setError("");
                navigate({ page: 1, limit: filters.limit });
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </FilterBar>
        {!!filters.rentalId && (
          <p className="panel-body quiet">
            Đang lọc hợp đồng{" "}
            <Link href={`/app/rentals/${filters.rentalId}`}>
              #{filters.rentalId.slice(0, 8)}
            </Link>
            . Chỉ gồm dòng đã xác nhận liên kết hợp đồng này.
          </p>
        )}
        {canManage && (
          <div className="panel-body toll-toolbar">
            <p className="quiet">
              Chọn tối đa 20 dòng trên trang hiện tại. Chỉ cho ghi chung khi
              từng dòng đã được xác nhận, gợi ý hiện tại rõ ràng và không có chi
              phí gần giống.
            </p>
            <Button
              type="button"
              disabled={pending || selectedRows.length === 0}
              onClick={() => setDialog("bulk")}
            >
              <Icon name="check" />
              Ghi chi phí {selectedRows.length} dòng đã chọn
            </Button>
          </div>
        )}
        <RefreshStatus
          pending={pending}
          label="Đang cập nhật danh sách đối soát…"
        />
        <div className="pending-region" aria-busy={pending}>
          <DataTable
            rows={initial.data}
            caption="Phí đường bộ nhập từ bảng kê"
            emptyState={{
              title: "Chưa có dòng phí phù hợp",
              description:
                "Nhập CSV để xem preview và đối soát, hoặc thay đổi bộ lọc. Không có dữ liệu VETC tự động.",
            }}
            columns={[
              ...(canManage
                ? [
                    {
                      key: "select",
                      label: "Chọn",
                      render: (item: TollPage["data"][number]) => (
                        <Input
                          type="checkbox"
                          disabled={pending || !bulkRecordable(item)}
                          checked={selectedRows.some(
                            (row) => row.id === item.id,
                          )}
                          aria-label={`Chọn dòng ${item.plate} ${formatDate(item.occurredAt)}`}
                          onChange={(event) => {
                            const next = selection.filter(
                              (value) => value.id !== item.id,
                            );
                            if (event.target.checked) {
                              if (selectedRows.length >= 20) {
                                setError(
                                  "Chỉ chọn tối đa 20 dòng trong một lượt ghi.",
                                );
                                return;
                              }
                              next.push({ id: item.id, version: item.version });
                            }
                            setError("");
                            setSelected({ scope, rows: next });
                          }}
                        />
                      ),
                    },
                  ]
                : []),
              {
                key: "plate",
                label: "Xe / bảng kê",
                render: (item) => (
                  <>
                    <button
                      className="fleet-record-link toll-record-button"
                      type="button"
                      disabled={pending}
                      onClick={() => setReview(item.id)}
                    >
                      {item.plate}
                    </button>
                    <small className="fleet-cell-meta">
                      {item.source} · {item.externalReference || "Không có mã"}
                    </small>
                    {item.vehicleId && (
                      <Link
                        className="fleet-cell-meta"
                        href={`/app/vehicles/${item.vehicleId}`}
                      >
                        Xe đã xác nhận
                      </Link>
                    )}
                  </>
                ),
              },
              {
                key: "time",
                label: "Qua trạm (VN)",
                render: (item) => (
                  <>
                    {formatDate(item.occurredAt)}
                    <small className="fleet-cell-meta">
                      {item.station || "Không ghi trạm"}
                    </small>
                  </>
                ),
              },
              {
                key: "amount",
                label: "Phí (VND)",
                render: (item) => (
                  <strong>{commercialMoney(item.amount)}</strong>
                ),
              },
              {
                key: "status",
                label: "Đối soát",
                render: (item) => (
                  <>
                    <Badge
                      tone={
                        item.status === "RECORDED"
                          ? "success"
                          : item.status === "NEEDS_REVIEW"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {tollStatusLabels[
                        item.status as keyof typeof tollStatusLabels
                      ] ?? item.status}
                    </Badge>
                    <small className="fleet-cell-meta">
                      {item.suggestion.ambiguous
                        ? "Gợi ý hợp đồng không rõ ràng"
                        : item.suggestion.vehicleId
                          ? `Gợi ý: ${item.suggestion.vehiclePlate ?? item.plate}${item.suggestion.rentalId ? ` · HĐ #${item.suggestion.rentalId.slice(0, 8)}` : " · không có HĐ"}`
                          : "Chưa có gợi ý xe"}
                    </small>
                    {!!item.possibleDuplicateMovementIds.length && (
                      <small className="toll-warning">
                        Có chi phí TOLL gần giống
                      </small>
                    )}
                  </>
                ),
              },
              {
                key: "links",
                label: "Liên kết",
                render: (item) => (
                  <div className="toll-links">
                    {item.rentalId && (
                      <Link href={`/app/rentals/${item.rentalId}`}>
                        Hợp đồng #{item.rentalId.slice(0, 8)}
                      </Link>
                    )}
                    {item.movementId ? (
                      <Link href={`/app/commercial/${item.movementId}`}>
                        Chi phí #{item.movementId.slice(0, 8)}
                        {item.reversedBy ? " · Đã đảo" : ""}
                      </Link>
                    ) : (
                      <span className="quiet">Chưa ghi chi phí</span>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      disabled={pending}
                      onClick={() => setReview(item.id)}
                    >
                      Xem / đối soát
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            {...initial}
            disabled={pending}
            onPage={(page) => navigate({ ...filters, page })}
          />
        </div>
      </Panel>
      {dialog === "import" && (
        <TollImportDialog
          businessId={context.business.id}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog === "bulk" && (
        <TollBulkDialog
          rows={selectedRows}
          businessId={context.business.id}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {review && (
        <TollReviewDialog
          key={review}
          id={review}
          businessId={context.business.id}
          onClose={() => setReview(null)}
          onSaved={saved}
        />
      )}
      {dialog === "vehicle" && (
        <FormDialog
          title="Lọc phí theo xe"
          onClose={() => setDialog(null)}
          dirty={vehicle !== filters.vehicleId}
          footer={
            <DialogActions
              submitLabel="Áp dụng xe đã chọn"
              onSubmit={() => {
                navigate({
                  ...filters,
                  page: 1,
                  vehicleId: vehicle,
                  rentalId: "",
                });
                setDialog(null);
              }}
            />
          }
        >
          <RecordPicker<Vehicle>
            businessId={context.business.id}
            path="/vehicles?sort=licensePlate&order=asc"
            title="Chọn xe"
            selected={vehicle}
            onSelect={(item) => setVehicle(item?.id ?? "")}
            render={(item) => (
              <>
                <strong>{item.licensePlate}</strong>
                <small>
                  {item.make} {item.model}
                </small>
              </>
            )}
          />
          <Button type="button" variant="ghost" onClick={() => setVehicle("")}>
            Bỏ lọc xe
          </Button>
        </FormDialog>
      )}
    </>
  );
}
