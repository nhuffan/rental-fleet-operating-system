"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, DialogActions } from "@/components/ui/form-dialog";
import {
  Button,
  Input,
  Panel,
  PanelHeader,
  Textarea,
} from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { useMutation } from "@/lib/api-client/use-mutation";
import { queryString, formatDate } from "@/lib/query";
import { RecordPicker } from "@/components/data-display/record-picker";
import { formatMoney } from "./query";
import { localDateTime, utcDateTime } from "@/lib/date-time";
import type {
  Customer,
  Rental,
  RentalCreate,
  VehicleAvailability,
} from "./types";
export function RentalWizard({
  businessId,
  currency,
  onClose,
}: {
  businessId: string;
  currency: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const mutation = useMutation(businessId);
  const [step, setStep] = useState(0);
  const [range, setRange] = useState({ startAt: "", endAt: "" });
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<VehicleAvailability | null>(null);
  const [terms, setTerms] = useState({
    rentalAmount: 0,
    depositRequiredAmount: 0,
    depositReceived: false,
    notes: "",
  });
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Rental | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string | null>(
    null,
  );
  const [timeEdited, setTimeEdited] = useState(false);
  const dirty =
    !created &&
    (timeEdited ||
      !!range.startAt ||
      !!vehicle ||
      !!customer ||
      terms.rentalAmount !== 0 ||
      terms.depositRequiredAmount !== 0 ||
      terms.depositReceived ||
      !!terms.notes);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const beforeNavigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (mutation.busy) return;
      setPendingDestination(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
      setDiscarding(true);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
    };
  }, [dirty, mutation.busy]);
  const close = () => {
    if (!mutation.busy) {
      if (onClose) onClose();
      else router.push("/app/rentals");
    }
  };
  const requestClose = () => {
    if (mutation.busy) return;
    if (dirty) {
      setPendingDestination(null);
      setDiscarding(true);
    } else close();
  };
  async function save(reserve: boolean) {
    if (!customer || !vehicle) return;
    const body: RentalCreate = {
      ...range,
      ...terms,
      customerId: customer.id,
      vehicleId: vehicle.id,
    };
    const rental =
      created ??
      (await mutation.mutateResult<Rental>({
        path: "/rentals",
        method: "POST",
        body,
      }));
    if (!rental) return;
    setCreated(rental);
    if (reserve) {
      const reserved = await mutation.mutateResult<Rental>({
        path: `/rentals/${rental.id}/reserve`,
        method: "POST",
      });
      if (!reserved) return;
    }
    router.push(
      `/app/rentals/${rental.id}?saved=${reserve ? "reserved" : "draft"}`,
    );
  }
  return (
    <>
      <Panel className="rental-wizard">
        <PanelHeader
          title="Thông tin hợp đồng"
          subtitle="Hoàn tất lần lượt 4 bước để tạo hợp đồng thuê."
          icon="rental"
          action={
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.busy}
              onClick={requestClose}
            >
              Hủy tạo hợp đồng
            </Button>
          }
        />
        <div className="panel-body">
          <ol className="rental-steps" aria-label="Các bước tạo hợp đồng">
            {["Thời gian", "Chọn xe", "Khách hàng", "Xác nhận"].map(
              (label, index) => (
                <li
                  key={label}
                  aria-current={step === index ? "step" : undefined}
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ),
            )}
          </ol>
          <MutationNotice error={error || mutation.error} message="" />
          {created && (
            <div className="notice notice-info">
              Bản nháp đã được tạo. Việc đặt xe chưa hoàn tất nếu server báo
              xung đột.{" "}
              <Link className="link-brand" href={`/app/rentals/${created.id}`}>
                Mở bản nháp
              </Link>
            </div>
          )}
          {step === 0 && (
            <form
              onInput={() => setTimeEdited(true)}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const next = {
                  startAt: utcDateTime(String(data.get("startAt"))),
                  endAt: utcDateTime(String(data.get("endAt"))),
                };
                if (
                  !next.startAt ||
                  !next.endAt ||
                  next.endAt <= next.startAt
                ) {
                  setError("Thời gian trả phải sau thời gian nhận xe.");
                  return;
                }
                if (
                  next.startAt !== range.startAt ||
                  next.endAt !== range.endAt
                )
                  setVehicle(null);
                setRange(next);
                setError("");
                setStep(1);
              }}
            >
              <p className="quiet">
                Thời gian theo giờ Việt Nam (UTC+7). Xe được kiểm tra lại khi
                xác nhận đặt.
              </p>
              <div className="form-grid">
                <label className="form-field">
                  Nhận xe lúc
                  <Input
                    type="datetime-local"
                    name="startAt"
                    required
                    defaultValue={
                      range.startAt ? localDateTime(range.startAt) : ""
                    }
                  />
                </label>
                <label className="form-field">
                  Trả xe dự kiến
                  <Input
                    type="datetime-local"
                    name="endAt"
                    required
                    defaultValue={range.endAt ? localDateTime(range.endAt) : ""}
                  />
                </label>
              </div>
              <Button type="submit">Tìm xe sẵn sàng</Button>
            </form>
          )}
          {step === 1 && (
            <>
              <p className="quiet">
                {formatDate(range.startAt)} → {formatDate(range.endAt)}
              </p>
              <RecordPicker<VehicleAvailability>
                businessId={businessId}
                path={`/vehicles/availability?${queryString({ ...range, availableOnly: "true" })}`}
                title="Chọn xe sẵn sàng"
                selected={vehicle?.id ?? ""}
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
              <div className="inline">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  Quay lại
                </Button>
                <Button disabled={!vehicle} onClick={() => setStep(2)}>
                  Chọn khách hàng →
                </Button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="quiet">
                Chỉ chọn khách hàng đang hoạt động.{" "}
                <Link
                  className="link-brand"
                  href="/app/customers"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở danh mục khách hàng
                </Link>
              </p>
              <RecordPicker<Customer>
                businessId={businessId}
                path="/customers?status=ACTIVE&sort=name&order=asc"
                title="Chọn khách hàng"
                selected={customer?.id ?? ""}
                onSelect={setCustomer}
                render={(item) => (
                  <>
                    <strong>{item.name}</strong>
                    <small>
                      {[item.phone, item.email].filter(Boolean).join(" · ")}
                    </small>
                  </>
                )}
              />
              <div className="inline">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Quay lại
                </Button>
                <Button disabled={!customer} onClick={() => setStep(3)}>
                  Xem lại hợp đồng →
                </Button>
              </div>
            </>
          )}
          {step === 3 && customer && vehicle && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(true);
              }}
            >
              <dl className="rental-review">
                <div>
                  <dt>Xe</dt>
                  <dd>
                    {vehicle.licensePlate} · {vehicle.make} {vehicle.model}
                  </dd>
                </div>
                <div>
                  <dt>Khách hàng</dt>
                  <dd>{customer.name}</dd>
                </div>
                <div>
                  <dt>Thời gian (VN)</dt>
                  <dd>
                    {formatDate(range.startAt)} → {formatDate(range.endAt)}
                  </dd>
                </div>
              </dl>
              <fieldset
                className="form-fieldset"
                disabled={mutation.busy || !!created}
              >
                <div className="form-grid">
                  <label className="form-field">
                    Tiền thuê ({currency})
                    <Input
                      type="number"
                      min={0}
                      max={999999999.99}
                      step="0.01"
                      required
                      value={terms.rentalAmount}
                      onChange={(e) =>
                        setTerms({
                          ...terms,
                          rentalAmount: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    Tiền cọc yêu cầu ({currency})
                    <Input
                      type="number"
                      min={0}
                      max={999999999.99}
                      step="0.01"
                      required
                      value={terms.depositRequiredAmount}
                      onChange={(e) =>
                        setTerms({
                          ...terms,
                          depositRequiredAmount: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="rental-checkbox">
                  <Input
                    type="checkbox"
                    checked={terms.depositReceived}
                    onChange={(e) =>
                      setTerms({ ...terms, depositReceived: e.target.checked })
                    }
                  />
                  Xác nhận cọc trên hợp đồng
                </label>
                <p className="quiet">
                  Xác nhận này không tạo giao dịch tiền cọc. Sau khi lưu, ghi
                  nhận khoản cọc thực tế tại phần Thu chi của hợp đồng.
                </p>
                <label className="form-field">
                  Ghi chú
                  <Textarea
                    maxLength={4000}
                    rows={3}
                    value={terms.notes}
                    onChange={(e) =>
                      setTerms({ ...terms, notes: e.target.value })
                    }
                  />
                </label>
              </fieldset>
              <p className="quiet">
                Tiền thuê:{" "}
                <strong>{formatMoney(terms.rentalAmount, currency)}</strong>.
                Bản nháp chưa giữ lịch xe; xác nhận đặt sẽ kiểm tra lịch trùng
                tại server.
              </p>
              <div className="rental-form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={mutation.busy || !!created}
                  onClick={() => setStep(2)}
                >
                  Quay lại
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={mutation.busy}
                  onClick={() => void save(false)}
                >
                  Lưu bản nháp
                </Button>
                <Button type="submit" disabled={mutation.busy}>
                  {mutation.busy
                    ? "Đang xử lý…"
                    : created
                      ? "Thử đặt xe lại"
                      : "Tạo và đặt xe"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Panel>
      {discarding && (
        <ConfirmDialog
          title="Bỏ thông tin chưa lưu?"
          onClose={() => setDiscarding(false)}
          footer={
            <DialogActions
              formId="discard-rental-wizard"
              onCancel={() => setDiscarding(false)}
              cancelLabel="Tiếp tục chỉnh sửa"
              submitLabel="Bỏ thay đổi"
            />
          }
        >
          <p>
            Thông tin tạo hợp đồng chưa được lưu. Bạn có muốn bỏ các thay đổi và
            rời khỏi bước tạo hợp đồng?
          </p>
          <form
            id="discard-rental-wizard"
            onSubmit={(event) => {
              event.preventDefault();
              setDiscarding(false);
              if (pendingDestination) router.push(pendingDestination);
              else close();
            }}
          />
        </ConfirmDialog>
      )}
    </>
  );
}
