"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import { DataTable, Pagination } from "@/components/data-display/table";
import { RecordPicker } from "@/components/data-display/record-picker";
import {
  ConfirmDialog,
  DialogActions,
  FormDialog,
} from "@/components/ui/form-dialog";
import {
  Badge,
  Button,
  Input,
  Notice,
  Panel,
  PanelHeader,
  RefreshStatus,
  Select,
} from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { formatDate, queryString } from "@/lib/query";
import { localDateTime, utcDateTime } from "@/lib/date-time";
import { pricingRequest, PricingError } from "./client";
import { formatVnd } from "./policy";
import type { RateCard, RateCardPage } from "./types";
import "./pricing.css";
export type RateFilters = {
  page: number;
  limit: number;
  scope: string;
  status: string;
};
type VehicleChoice = {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
};
export function RateCards({
  initial,
  context,
  filters,
}: {
  initial: RateCardPage;
  context: Me;
  filters: RateFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<RateCard | null | undefined>(undefined);
  const [removing, setRemoving] = useState<RateCard | null>(null);
  function navigate(next: RateFilters) {
    startTransition(() =>
      router.push(`/app/rentals/pricing?${queryString(next)}`, {
        scroll: false,
      }),
    );
  }
  if (context.business.currency !== "VND")
    return (
      <Notice tone="warning">
        Bảng giá hiện chỉ hỗ trợ doanh nghiệp dùng VND.
      </Notice>
    );
  return (
    <>
      <Panel>
        <PanelHeader
          title="Bảng giá tiền thuê"
          subtitle="Giá riêng của xe được ưu tiên; giá mặc định chỉ dùng khi xe chưa có bảng giá hiệu lực."
          icon="wallet"
          action={
            context.permissions.includes("rental.manage") && (
              <Button onClick={() => setEditor(null)}>
                <Icon name="plus" />
                Thêm bảng giá
              </Button>
            )
          }
        />
        <FilterBar
          key={JSON.stringify(filters)}
          busy={pending}
          aria-label="Lọc bảng giá"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            navigate({
              ...filters,
              page: 1,
              scope: String(form.get("scope")),
              status: String(form.get("status")),
            });
          }}
        >
          <label className="form-field">
            Phạm vi
            <Select name="scope" defaultValue={filters.scope}>
              <option value="">Mọi phạm vi</option>
              <option value="VEHICLE">Riêng từng xe</option>
              <option value="BUSINESS">Mặc định doanh nghiệp</option>
            </Select>
          </label>
          <label className="form-field">
            Trạng thái
            <Select name="status" defaultValue={filters.status}>
              <option value="">Mọi trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngưng hoạt động</option>
            </Select>
          </label>
          <div className="filter-bar-actions">
            <Button type="submit" variant="secondary" loading={pending}>
              Áp dụng
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                navigate({ ...filters, page: 1, scope: "", status: "" })
              }
            >
              Xóa bộ lọc
            </Button>
          </div>
        </FilterBar>
        <div className="pending-region" aria-busy={pending}>
          <RefreshStatus pending={pending} />
          <DataTable
            rows={initial.data}
            caption="Bảng giá thuê xe"
            emptyState={{
              title: "Chưa có bảng giá phù hợp",
              description:
                "Thêm bảng giá riêng cho xe hoặc giá mặc định doanh nghiệp. Khi chưa có giá hiệu lực, báo giá yêu cầu Owner thỏa thuận thủ công.",
              icon: "wallet",
            }}
            columns={[
              {
                key: "name",
                label: "Bảng giá / phạm vi",
                render: (rate) => (
                  <div className="pricing-rate-scope">
                    <strong>{rate.name}</strong>
                    <small>
                      {rate.vehicleId
                        ? rate.vehiclePlate || rate.vehicleId
                        : "Mặc định doanh nghiệp"}{" "}
                      · v{rate.version}
                    </small>
                  </div>
                ),
              },
              {
                key: "rates",
                label: "Đơn giá (VND)",
                render: (rate) => (
                  <div className="pricing-rate-scope">
                    <span>
                      Giờ:{" "}
                      {rate.hourlyRate
                        ? formatVnd(rate.hourlyRate)
                        : "Chưa cấu hình"}
                    </span>
                    <span>
                      Ngày:{" "}
                      {rate.dailyRate
                        ? formatVnd(rate.dailyRate)
                        : "Chưa cấu hình"}
                    </span>
                    <small>
                      Tối thiểu {formatVnd(rate.minimumCharge)}
                      {rate.extraHourRate
                        ? ` · Giờ lẻ ${formatVnd(rate.extraHourRate)}`
                        : ""}
                    </small>
                  </div>
                ),
              },
              {
                key: "effective",
                label: "Hiệu lực theo giờ nhận xe (VN)",
                render: (rate) => (
                  <div className="pricing-rate-scope">
                    <span>Từ {formatDate(rate.effectiveFrom)}</span>
                    <small>
                      {rate.effectiveUntil
                        ? `Đến trước ${formatDate(rate.effectiveUntil)}`
                        : "Chưa đặt ngày kết thúc"}
                    </small>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Trạng thái",
                render: (rate) => (
                  <Badge
                    tone={rate.status === "ACTIVE" ? "success" : "neutral"}
                  >
                    {rate.status === "ACTIVE" ? "Hoạt động" : "Ngưng hoạt động"}
                  </Badge>
                ),
              },
              {
                key: "actions",
                label: "Thao tác",
                render: (rate) =>
                  context.permissions.includes("rental.manage") && (
                    <div className="pricing-rate-actions">
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => setEditor(rate)}
                      >
                        Chỉnh sửa
                      </Button>
                      <Button
                        size="small"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setRemoving(rate)}
                      >
                        Xóa
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
      <p className="quiet">
        Bảng giá áp dụng tại giờ nhận xe, theo khoảng hiệu lực đầu bao gồm và
        cuối không bao gồm. Thay đổi bảng giá không tính lại hợp đồng đã xác
        nhận. Giá hợp đồng độc lập với tiền thực thu, tiền cọc và chi phí.
      </p>
      {editor !== undefined && (
        <RateCardEditor
          key={editor?.id ?? "new"}
          rate={editor}
          businessId={context.business.id}
          onClose={() => setEditor(undefined)}
        />
      )}
      {removing && (
        <DeleteRate
          rate={removing}
          businessId={context.business.id}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
function RateCardEditor({
  rate,
  businessId,
  onClose,
}: {
  rate: RateCard | null;
  businessId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scope, setScope] = useState(rate?.vehicleId ? "VEHICLE" : "BUSINESS");
  const [vehicle, setVehicle] = useState<VehicleChoice | null>(null);
  const vehicleId = vehicle?.id ?? rate?.vehicleId ?? "";
  return (
    <FormDialog
      title={rate ? "Chỉnh sửa bảng giá" : "Thêm bảng giá"}
      description="Đơn giá VND nguyên đồng. Có thể cấu hình theo giờ, theo ngày hoặc cả hai."
      busy={busy}
      dirty={scope !== (rate?.vehicleId ? "VEHICLE" : "BUSINESS") || !!vehicle}
      onClose={onClose}
      footer={
        <DialogActions
          formId="rental-rate-card"
          busy={busy}
          onCancel={onClose}
          submitLabel="Lưu bảng giá"
        />
      }
    >
      {error && <Notice tone="danger">{error}</Notice>}
      <label className="form-field">
        Áp dụng cho
        <Select
          name="scope"
          form="rental-rate-card"
          value={scope}
          disabled={busy}
          onChange={(event) => setScope(event.target.value)}
        >
          <option value="BUSINESS">Mặc định doanh nghiệp</option>
          <option value="VEHICLE">Một xe cụ thể</option>
        </Select>
      </label>
      {scope === "VEHICLE" && (
        <>
          <p className="quiet">
            Xe đang chọn:{" "}
            <strong>
              {vehicle?.licensePlate ?? rate?.vehiclePlate ?? "Chưa chọn xe"}
            </strong>
          </p>
          <RecordPicker<VehicleChoice>
            businessId={businessId}
            path="/vehicles?status=ACTIVE&sort=licensePlate&order=asc"
            title="Chọn xe áp dụng giá"
            selected={vehicleId}
            disabled={busy}
            onSelect={setVehicle}
            render={(item) => (
              <>
                <strong>{item.licensePlate}</strong>
                <small>
                  {item.make} {item.model}
                </small>
              </>
            )}
          />
        </>
      )}
      <form
        id="rental-rate-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const form = new FormData(event.currentTarget);
          const effectiveFrom = utcDateTime(String(form.get("effectiveFrom")));
          const effectiveUntil = String(form.get("effectiveUntil"))
            ? utcDateTime(String(form.get("effectiveUntil")))
            : null;
          const hourlyRate = String(form.get("hourlyRate")).trim() || null;
          const dailyRate = String(form.get("dailyRate")).trim() || null;
          const extraHourRate =
            String(form.get("extraHourRate")).trim() || null;
          if (!hourlyRate && !dailyRate) {
            setError("Nhập ít nhất một đơn giá theo giờ hoặc theo ngày.");
            return;
          }
          if (extraHourRate && !dailyRate) {
            setError("Cần đơn giá ngày trước khi cấu hình giờ lẻ.");
            return;
          }
          if (
            !effectiveFrom ||
            (effectiveUntil && effectiveUntil <= effectiveFrom)
          ) {
            setError("Thời điểm kết thúc phải sau thời điểm bắt đầu hiệu lực.");
            return;
          }
          if (scope === "VEHICLE" && !vehicleId) {
            setError("Chọn xe áp dụng bảng giá.");
            return;
          }
          setBusy(true);
          try {
            await pricingRequest(
              businessId,
              rate ? `/pricing/rates/${rate.id}` : "/pricing/rates",
              rate ? "PATCH" : "POST",
              {
                name: String(form.get("name")).trim(),
                vehicleId: scope === "VEHICLE" ? vehicleId : null,
                hourlyRate,
                dailyRate,
                minimumCharge: String(form.get("minimumCharge")),
                extraHourRate,
                effectiveFrom,
                effectiveUntil,
                status: String(form.get("status")),
                ...(rate ? { version: rate.version } : {}),
              },
            );
            router.refresh();
            onClose();
          } catch (cause) {
            if (cause instanceof PricingError && cause.status === 401)
              router.replace("/login");
            setError(
              cause instanceof PricingError
                ? cause.message
                : "Không thể lưu bảng giá. Kiểm tra kết nối và thử lại.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label className="form-field">
            Tên bảng giá
            <Input
              name="name"
              required
              maxLength={120}
              defaultValue={rate?.name ?? ""}
            />
          </label>
          <div className="form-grid">
            <RateAmount
              name="hourlyRate"
              label="Đơn giá giờ"
              value={rate?.hourlyRate}
            />
            <RateAmount
              name="dailyRate"
              label="Đơn giá ngày 24 giờ"
              value={rate?.dailyRate}
            />
            <RateAmount
              name="minimumCharge"
              label="Phí thuê tối thiểu"
              value={rate?.minimumCharge ?? "0"}
              zero
              required
            />
            <RateAmount
              name="extraHourRate"
              label="Đơn giá giờ lẻ của ngày"
              value={rate?.extraHourRate}
            />
          </div>
          <p className="quiet">
            Theo giờ: làm tròn lên từng giờ bắt đầu. Theo ngày: làm tròn lên
            từng 24 giờ; nếu có giá giờ lẻ, phần dư tính theo giờ bắt đầu và
            không vượt một giá ngày.
          </p>
          <div className="form-grid">
            <label className="form-field">
              Bắt đầu hiệu lực (VN)
              <Input
                name="effectiveFrom"
                type="datetime-local"
                required
                defaultValue={rate ? localDateTime(rate.effectiveFrom) : ""}
              />
            </label>
            <label className="form-field">
              Kết thúc hiệu lực (VN, tùy chọn)
              <Input
                name="effectiveUntil"
                type="datetime-local"
                defaultValue={
                  rate?.effectiveUntil ? localDateTime(rate.effectiveUntil) : ""
                }
              />
            </label>
          </div>
          <label className="form-field">
            Trạng thái
            <Select name="status" defaultValue={rate?.status ?? "ACTIVE"}>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngưng hoạt động</option>
            </Select>
          </label>
        </fieldset>
      </form>
    </FormDialog>
  );
}
function RateAmount({
  name,
  label,
  value,
  zero = false,
  required = false,
}: {
  name: string;
  label: string;
  value?: string | null;
  zero?: boolean;
  required?: boolean;
}) {
  return (
    <label className="form-field">
      {label} (VND)
      <Input
        name={name}
        inputMode="numeric"
        type="text"
        maxLength={9}
        pattern={zero ? "(0|[1-9][0-9]{0,8})" : "[1-9][0-9]{0,8}"}
        required={required}
        defaultValue={value ?? ""}
      />
      <small>
        {zero ? "Từ 0" : "Từ 1"} đến 999.999.999
        {required ? "." : "; để trống nếu không cấu hình."}
      </small>
    </label>
  );
}
function DeleteRate({
  rate,
  businessId,
  onClose,
}: {
  rate: RateCard;
  businessId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <ConfirmDialog
      title="Xóa bảng giá?"
      busy={busy}
      onClose={onClose}
      footer={
        <DialogActions
          formId="delete-rental-rate"
          busy={busy}
          onCancel={onClose}
          submitLabel="Xóa bảng giá"
          submitIcon="close"
        />
      }
    >
      <p>
        Xóa <strong>{rate.name}</strong>. Bảng giá đã có báo giá được giữ lại;
        bạn có thể chuyển sang ngưng hoạt động thay vì xóa.
      </p>
      {error && <Notice tone="danger">{error}</Notice>}
      <form
        id="delete-rental-rate"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await pricingRequest(
              businessId,
              `/pricing/rates/${rate.id}?version=${rate.version}`,
              "DELETE",
            );
            router.refresh();
            onClose();
          } catch (cause) {
            if (cause instanceof PricingError && cause.status === 401)
              router.replace("/login");
            setError(
              cause instanceof PricingError
                ? cause.message
                : "Không thể xóa bảng giá. Kiểm tra kết nối và thử lại.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
    </ConfirmDialog>
  );
}
