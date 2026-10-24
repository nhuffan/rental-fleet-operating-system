"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { Button, Input, Select, Textarea } from "@/components/ui/primitives";
import { MutationNotice } from "@/components/feedback/mutation-notice";
import { RecordPicker } from "@/components/data-display/record-picker";
import { useMutation } from "@/lib/api-client/use-mutation";
import { localDateTime, utcDateTime } from "@/lib/date-time";
import type { Vehicle } from "@/features/fleet/vehicles/types";
import type { Rental } from "@/features/rentals/types";
import { categoryLabels, kindLabels, commercialMoney } from "./query";
import type { MovementCreate, MovementKind, RentalCommercial } from "./types";
const expenseCategories = [
  "FUEL",
  "MAINTENANCE",
  "TOLL",
  "INSURANCE",
  "OTHER_EXPENSE",
] as const;
export function MovementEditor({
  kind,
  businessId,
  rental,
  onClose,
  onSaved,
}: {
  kind: MovementKind;
  businessId: string;
  rental?: Rental;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const mutation = useMutation(businessId);
  const [error, setError] = useState("");
  const [rentalId, setRentalId] = useState(rental?.id ?? "");
  const [vehicleId, setVehicleId] = useState("");
  const [selectedRental, setSelectedRental] = useState<Rental | null>(
    rental ?? null,
  );
  const [link, setLink] = useState<"none" | "vehicle" | "rental">(
    rental ? "rental" : "none",
  );
  const requiresRental =
    kind === "RENTAL_PAYMENT" || kind.startsWith("DEPOSIT_");
  const rentalLinked = requiresRental || link === "rental";
  const balanceScope = `${businessId}:${rentalId}`;
  const [balance, setBalance] = useState<{
    scope: string;
    data: RentalCommercial | null;
    error: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const rentalBalance = balance?.scope === balanceScope ? balance : null;
  const needsBalance = kind === "DEPOSIT_REFUND" || kind === "DEPOSIT_RETAIN";
  useEffect(() => {
    if (!rentalId || !requiresRental) return;
    const controller = new AbortController();
    async function load() {
      try {
        const {
          data: { session },
        } = await browserClient().auth.getSession();
        if (!session)
          throw new Error(
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
          );
        const response = await fetch(
          `${publicEnv().api}/api/v1/rentals/${rentalId}/commercial`,
          {
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "X-Business-Id": businessId,
            },
          },
        );
        if (!response.ok)
          throw new Error("Không thể tải số dư hợp đồng. Vui lòng thử lại.");
        const data: RentalCommercial = await response.json();
        if (!controller.signal.aborted)
          setBalance({ scope: balanceScope, data, error: "" });
      } catch (cause) {
        if (!controller.signal.aborted)
          setBalance({
            scope: balanceScope,
            data: null,
            error:
              cause instanceof Error ? cause.message : "Không thể tải số dư.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, rentalId, balanceScope, requiresRental, retry]);
  return (
    <FormDialog
      title={kindLabels[kind]}
      size="wide"
      dirty={
        rentalId !== (rental?.id ?? "") ||
        !!vehicleId ||
        link !== (rental ? "rental" : "none")
      }
      footer={
        <DialogActions
          formId="commercial-movement-form"
          busy={mutation.busy}
          onCancel={onClose}
          submitLabel="Ghi nhận"
          submitDisabled={needsBalance && !rentalBalance?.data}
        />
      }
      busy={mutation.busy}
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
    >
      <div>
        <MutationNotice error={error || mutation.error} message="" />
        <p className="quiet">
          Ghi nhận thủ công bằng VND nguyên đồng, không kết nối ngân hàng hoặc
          VETC. Bản ghi đã lưu chỉ sửa sai bằng thao tác đảo có lý do.
        </p>
        {!requiresRental && !rental && (
          <label className="form-field">
            Liên kết{" "}
            <Select
              disabled={mutation.busy}
              value={link}
              onChange={(event) => {
                setLink(event.target.value as typeof link);
                setRentalId("");
                setVehicleId("");
                setSelectedRental(null);
              }}
            >
              <option value="none">Toàn doanh nghiệp</option>
              <option value="vehicle">Một xe</option>
              <option value="rental">Một hợp đồng</option>
            </Select>
          </label>
        )}
        {rental ? (
          <p>
            <strong>{rental.vehicle.licensePlate}</strong> · Hợp đồng #
            {rental.id.slice(0, 8)}
          </p>
        ) : rentalLinked ? (
          <RecordPicker<Rental>
            businessId={businessId}
            path="/rentals?sort=createdAt&order=desc"
            title="Chọn hợp đồng"
            selected={rentalId}
            disabled={mutation.busy}
            onSelect={(item) => {
              setRentalId(item?.id ?? "");
              setSelectedRental(item);
            }}
            render={(item) => (
              <>
                <strong>
                  {item.vehicle.licensePlate} · #{item.id.slice(0, 8)}
                </strong>
                <small>
                  {item.customer.name} · {item.status}
                </small>
              </>
            )}
          />
        ) : link === "vehicle" ? (
          <RecordPicker<Vehicle>
            businessId={businessId}
            path="/vehicles?sort=licensePlate&order=asc"
            title="Chọn xe"
            selected={vehicleId}
            disabled={mutation.busy}
            onSelect={(item) => setVehicleId(item?.id ?? "")}
            render={(item) => (
              <>
                <strong>{item.licensePlate}</strong>
                <small>
                  {item.make} {item.model}
                </small>
              </>
            )}
          />
        ) : null}
        {selectedRental && !rental && (
          <p className="quiet">
            Đã chọn: {selectedRental.vehicle.licensePlate} · #
            {selectedRental.id.slice(0, 8)}. Xe được lấy theo hợp đồng.
          </p>
        )}
        {requiresRental && rentalId && (
          <div className="commercial-balance-preview" role="status">
            {rentalBalance?.data ? (
              <>
                Cọc hiện có:{" "}
                <strong>
                  {commercialMoney(rentalBalance.data.depositBalance)}
                </strong>{" "}
                · Tiền thuê còn thiếu:{" "}
                {commercialMoney(rentalBalance.data.outstandingAmount)}
                <small>Số dư và thời điểm được kiểm tra lại khi lưu.</small>
              </>
            ) : rentalBalance?.error ? (
              <>
                <p>{rentalBalance.error}</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setBalance(null);
                    setRetry((value) => value + 1);
                  }}
                >
                  Tải lại số dư
                </Button>
              </>
            ) : (
              "Đang tải số dư hợp đồng…"
            )}
          </div>
        )}
        <form
          id="commercial-movement-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget),
              amount = String(form.get("amount")).trim(),
              occurredAt = utcDateTime(String(form.get("occurredAt")));
            if (!/^[1-9]\d{0,14}$/.test(amount)) {
              setError(
                "Nhập số tiền nguyên đồng từ 1 đến 999.999.999.999.999 VND, không dấu phân cách.",
              );
              return;
            }
            if (!occurredAt) {
              setError("Thời điểm giao dịch chưa hợp lệ.");
              return;
            }
            if (
              (rentalLinked && !rentalId) ||
              (link === "vehicle" && !vehicleId)
            ) {
              setError("Chọn liên kết trước khi ghi nhận.");
              return;
            }
            if (needsBalance && !rentalBalance?.data) {
              setError(
                "Tải số dư cọc thành công trước khi hoàn hoặc giữ lại cọc.",
              );
              return;
            }
            const category: MovementCreate["category"] =
              kind === "EXPENSE"
                ? (String(form.get("category")) as MovementCreate["category"])
                : kind === "RENTAL_PAYMENT"
                  ? "RENTAL"
                  : kind === "MISC_INCOME"
                    ? "OTHER_INCOME"
                    : "DEPOSIT";
            const body: MovementCreate = {
              kind,
              category,
              amount,
              occurredAt,
              reference: String(form.get("reference")).trim(),
              notes: String(form.get("notes")).trim(),
              ...(rentalLinked
                ? { rentalId }
                : link === "vehicle"
                  ? { vehicleId }
                  : {}),
            };
            if (
              await mutation.mutate({
                path: "/commercial/movements",
                method: "POST",
                body,
              })
            ) {
              onSaved("Đã ghi nhận giao dịch.");
              onClose();
            }
          }}
        >
          <fieldset className="form-fieldset" disabled={mutation.busy}>
            {kind === "EXPENSE" && (
              <label className="form-field">
                Danh mục chi phí{" "}
                <Select name="category" required>
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category]}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <div className="form-grid">
              <label className="form-field">
                Số tiền (VND){" "}
                <Input
                  name="amount"
                  inputMode="numeric"
                  pattern="[1-9][0-9]{0,14}"
                  maxLength={15}
                  required
                  placeholder="Ví dụ: 1500000"
                />
                <small>
                  Nhập số nguyên dương; loại giao dịch xác định chiều thu/chi.
                </small>
              </label>
              <label className="form-field">
                Thời điểm giao dịch (giờ Việt Nam){" "}
                <Input
                  name="occurredAt"
                  type="datetime-local"
                  required
                  defaultValue={localDateTime(new Date().toISOString())}
                />
              </label>
            </div>
            <label className="form-field">
              Mã tham chiếu <Input name="reference" maxLength={120} />
            </label>
            <label className="form-field">
              Ghi chú <Textarea name="notes" rows={3} maxLength={2000} />
            </label>
            {kind === "DEPOSIT_RETAIN" && (
              <p className="notice notice-warning">
                Giữ lại cọc chuyển nghĩa vụ hoàn cọc thành doanh thu, không làm
                phát sinh tiền thu mới. Chỉ giữ lại trong số dư cọc hiện có.
              </p>
            )}
            {kind === "DEPOSIT_REFUND" && (
              <p className="quiet">
                Hoàn cọc không được vượt số dư cọc hiện có của hợp đồng.
              </p>
            )}
          </fieldset>
        </form>
      </div>
    </FormDialog>
  );
}
