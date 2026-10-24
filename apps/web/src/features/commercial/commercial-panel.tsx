"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import {
  Badge,
  Button,
  Panel,
  PanelHeader,
  RefreshStatus,
} from "@/components/ui/primitives";
import {
  Combobox,
  DateInput,
  FilterBar,
  SearchField,
} from "@/components/ui/controls";
import { DataTable, Pagination } from "@/components/data-display/table";
import { RecordPicker } from "@/components/data-display/record-picker";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import type { Rental } from "@/features/rentals/types";
import type { Vehicle } from "@/features/fleet/vehicles/types";
import { formatDate, queryString } from "@/lib/query";
import {
  commercialMoney,
  kinds,
  kindLabels,
  categoryLabels,
  statusLabels,
  type CommercialFilters,
} from "./query";
import type { CommercialSummary, MovementKind, MovementPage } from "./types";
import { SummaryCards } from "./summary";
import { MovementActions } from "./movement-actions";
import { MovementEditor } from "./movement-editor";
export function CommercialPanel({
  initial,
  summary,
  context,
  filters,
}: {
  initial: MovementPage;
  summary: CommercialSummary;
  context: Me;
  filters: CommercialFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<MovementKind | null>(null);
  const [referencePicker, setReferencePicker] = useState<
    "vehicle" | "rental" | null
  >(null);
  const [referenceId, setReferenceId] = useState("");
  const [message, setMessage] = useState("");
  const [filterError, setFilterError] = useState("");
  function navigate(values: Record<string, string | number>) {
    startTransition(() =>
      router.push(`/app/commercial?${queryString(values)}`, { scroll: false }),
    );
  }
  return (
    <>
      <MutationNotice message={message} error={filterError} />
      {context.permissions.includes("commercial.manage") && (
        <MovementActions disabled={pending} onSelect={setEditor} />
      )}
      <SummaryCards summary={summary} />
      <Panel>
        <div className="commercial-basis">
          <strong>Cơ sở: giao dịch đã ghi nhận · VND nguyên đồng</strong>
          <p>
            Thẻ tổng hợp theo khoảng ngày, xe và hợp đồng đã chọn; tìm kiếm,
            loại, danh mục và trạng thái chỉ lọc danh sách. Doanh thu gồm cọc
            giữ lại nhưng khoản này không tạo thêm tiền mặt. Chỉ số tiền thu và
            dòng tiền vận hành loại trừ mọi khoản nhận/hoàn cọc. Tiền cọc đang
            giữ là số dư tích lũy đến hết ngày kết thúc, bao gồm các khoản trước
            ngày bắt đầu. Nếu không chọn ngày kết thúc, số dư được tính tại thời
            điểm tải.
          </p>
          <div className="commercial-cash">
            <span>
              Thu tiền thuê & thu khác{" "}
              <strong>{commercialMoney(summary.cashReceived)}</strong>
            </span>
            <span>
              Dòng tiền vận hành thuần{" "}
              <strong>{commercialMoney(summary.netOperatingCashFlow)}</strong>
            </span>
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelHeader
          title="Sổ giao dịch"
          subtitle={`${initial.total} bản ghi phù hợp · Bản ghi gốc và bút toán đảo được giữ lại`}
          icon="wallet"
        />
        <FilterBar
          key={JSON.stringify(filters)}
          busy={pending}
          aria-label="Bộ lọc giao dịch"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const from = String(form.get("from")),
              until = String(form.get("until"));
            if (from && until && from > until) {
              setFilterError(
                "Ngày bắt đầu phải trước hoặc cùng ngày kết thúc.",
              );
              return;
            }
            setFilterError("");
            navigate({
              ...filters,
              page: 1,
              search: String(form.get("search")).trim(),
              from: String(form.get("from")),
              until: String(form.get("until")),
              kind: String(form.get("kind")),
              category: String(form.get("category")),
              status: String(form.get("status")),
            });
          }}
        >
          <SearchField
            name="search"
            maxLength={100}
            defaultValue={filters.search}
            label="Tìm giao dịch"
            placeholder="Tham chiếu hoặc ghi chú…"
          />
          <label className="form-field">
            Từ ngày (VN)
            <DateInput name="from" defaultValue={filters.from} />
          </label>
          <label className="form-field">
            Đến hết ngày (VN)
            <DateInput name="until" defaultValue={filters.until} />
          </label>
          <Combobox
            name="kind"
            label="Loại giao dịch"
            defaultValue={filters.kind}
            options={[
              { value: "", label: "Mọi loại" },
              ...kinds.map((kind) => ({
                value: kind,
                label: kindLabels[kind],
              })),
            ]}
          />
          <Combobox
            name="category"
            label="Danh mục"
            defaultValue={filters.category}
            options={[
              { value: "", label: "Mọi danh mục" },
              ...Object.entries(categoryLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <Combobox
            name="status"
            label="Trạng thái giao dịch"
            defaultValue={filters.status}
            options={[
              { value: "", label: "Mọi trạng thái" },
              ...Object.entries(statusLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <div className="filter-bar-actions">
            <Button variant="secondary" type="submit" loading={pending}>
              Áp dụng
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={pending}
              onClick={(event) => {
                event.currentTarget.form?.reset();
                setFilterError("");
                navigate({ page: 1 });
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </FilterBar>
        <div className="commercial-reference-filters">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setReferenceId(filters.vehicleId);
              setReferencePicker("vehicle");
            }}
          >
            Lọc theo xe{filters.vehicleId ? " · Đã chọn" : ""}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setReferenceId(filters.rentalId);
              setReferencePicker("rental");
            }}
          >
            Lọc theo hợp đồng{filters.rentalId ? " · Đã chọn" : ""}
          </Button>
          {filters.vehicleId && (
            <Link
              className="fleet-record-link"
              href={`/app/vehicles/${filters.vehicleId}`}
            >
              Xe #{filters.vehicleId.slice(0, 8)}
            </Link>
          )}
          {filters.rentalId && (
            <Link
              className="fleet-record-link"
              href={`/app/rentals/${filters.rentalId}`}
            >
              Hợp đồng #{filters.rentalId.slice(0, 8)}
            </Link>
          )}
        </div>
        <div className="pending-region" aria-busy={pending}>
          <RefreshStatus pending={pending} />
          <DataTable
            caption="Giao dịch thương mại"
            rows={initial.data}
            columns={[
              {
                key: "date",
                label: "Thời điểm (VN)",
                render: (item) => (
                  <>
                    <Link
                      className="fleet-record-link"
                      href={`/app/commercial/${item.id}`}
                    >
                      {formatDate(item.occurredAt)}
                    </Link>
                    <small className="fleet-cell-meta">
                      #{item.id.slice(0, 8)}
                    </small>
                  </>
                ),
              },
              {
                key: "kind",
                label: "Loại / danh mục",
                render: (item) => (
                  <>
                    <strong>{kindLabels[item.kind]}</strong>
                    <small className="fleet-cell-meta">
                      {categoryLabels[item.category]}
                    </small>
                  </>
                ),
              },
              {
                key: "amount",
                label: "Số tiền (VND)",
                render: (item) => (
                  <span className="commercial-money">
                    {commercialMoney(item.amount)}
                    {item.status === "REVERSAL" && (
                      <small className="fleet-cell-meta">
                        Đảo chiều bản ghi gốc
                      </small>
                    )}
                  </span>
                ),
              },
              {
                key: "reference",
                label: "Liên kết / tham chiếu",
                render: (item) => (
                  <>
                    {item.rentalId ? (
                      <Link
                        className="fleet-record-link"
                        href={`/app/rentals/${item.rentalId}`}
                      >
                        Hợp đồng #{item.rentalId.slice(0, 8)}
                      </Link>
                    ) : item.vehicleId ? (
                      <Link
                        className="fleet-record-link"
                        href={`/app/vehicles/${item.vehicleId}`}
                      >
                        Xe #{item.vehicleId.slice(0, 8)}
                      </Link>
                    ) : (
                      "Toàn doanh nghiệp"
                    )}
                    <small className="fleet-cell-meta">
                      {item.reference || "Không có tham chiếu"}
                    </small>
                  </>
                ),
              },
              {
                key: "status",
                label: "Trạng thái",
                render: (item) => (
                  <Badge
                    tone={item.status === "POSTED" ? "success" : "neutral"}
                  >
                    {statusLabels[item.status]}
                  </Badge>
                ),
              },
            ]}
          />
          <Pagination
            disabled={pending}
            {...initial}
            onPage={(page) => navigate({ ...filters, page })}
          />
        </div>
      </Panel>
      {editor && (
        <MovementEditor
          kind={editor}
          businessId={context.business.id}
          onClose={() => setEditor(null)}
          onSaved={setMessage}
        />
      )}
      {referencePicker && (
        <FormDialog
          size="wide"
          dirty={
            referenceId !==
            (referencePicker === "vehicle"
              ? filters.vehicleId
              : filters.rentalId)
          }
          busy={pending}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  navigate({
                    ...filters,
                    page: 1,
                    [referencePicker === "vehicle" ? "vehicleId" : "rentalId"]:
                      "",
                  });
                  setReferencePicker(null);
                }}
              >
                Bỏ lọc liên kết này
              </Button>
              <DialogActions
                formId="commercial-reference-filter"
                busy={pending}
                onCancel={() => setReferencePicker(null)}
                submitLabel="Áp dụng liên kết"
                submitDisabled={!referenceId}
              />
            </>
          }
          title={
            referencePicker === "vehicle" ? "Lọc theo xe" : "Lọc theo hợp đồng"
          }
          onClose={() => setReferencePicker(null)}
        >
          <div>
            <form
              id="commercial-reference-filter"
              onSubmit={(event) => {
                event.preventDefault();
                if (!referenceId || pending) return;
                navigate({
                  ...filters,
                  page: 1,
                  vehicleId: referencePicker === "vehicle" ? referenceId : "",
                  rentalId: referencePicker === "rental" ? referenceId : "",
                });
                setReferencePicker(null);
              }}
            />
            {referencePicker === "vehicle" ? (
              <RecordPicker<Vehicle>
                businessId={context.business.id}
                path="/vehicles?sort=licensePlate&order=asc"
                title="Chọn xe để lọc"
                selected={referenceId}
                onSelect={(item) => setReferenceId(item?.id ?? "")}
                render={(item) => (
                  <>
                    <strong>{item.licensePlate}</strong>
                    <small>
                      {item.make} {item.model}
                    </small>
                  </>
                )}
              />
            ) : (
              <RecordPicker<Rental>
                businessId={context.business.id}
                path="/rentals?sort=createdAt&order=desc"
                title="Chọn hợp đồng để lọc"
                selected={referenceId}
                onSelect={(item) => setReferenceId(item?.id ?? "")}
                render={(item) => (
                  <>
                    <strong>
                      {item.vehicle.licensePlate} · #{item.id.slice(0, 8)}
                    </strong>
                    <small>{item.customer.name}</small>
                  </>
                )}
              />
            )}
          </div>
        </FormDialog>
      )}
    </>
  );
}
