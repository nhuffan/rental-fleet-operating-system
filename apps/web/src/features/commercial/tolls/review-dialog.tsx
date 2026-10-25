"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormDialog, DialogActions } from "@/components/ui/form-dialog";
import {
  Badge,
  Button,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { RecordPicker } from "@/components/data-display/record-picker";
import type { Vehicle } from "@/features/fleet/vehicles/types";
import type { Rental } from "@/features/rentals/types";
import { formatDate } from "@/lib/query";
import { commercialMoney } from "../query";
import { tollRequest, TollError } from "./client";
import { bulkRecordable, tollStatusLabels } from "./policy";
import type { Toll, TollDetail } from "./types";
export function TollReviewDialog({
  id,
  businessId,
  onClose,
  onSaved,
}: {
  id: string;
  businessId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<TollDetail | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [rentalId, setRentalId] = useState("");
  const [action, setAction] = useState("review");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [picker, setPicker] = useState<"vehicle" | "rental" | null>(null);
  const active = useRef<AbortController | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    void tollRequest<TollDetail>(
      businessId,
      `/tolls/${id}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (controller.signal.aborted) return;
        setDetail(value);
        setVehicleId(value.vehicleId ?? "");
        setRentalId(value.rentalId ?? "");
        setLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof TollError && error.status === 401)
          router.replace("/login");
        setError(
          error instanceof Error ? error.message : "Chưa tải được dòng phí.",
        );
        setLoading(false);
      });
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, [businessId, id, router, attempt]);
  const terminal = detail?.status === "RECORDED";
  return (
    <FormDialog
      title="Đối soát dòng phí đường bộ"
      description={`Bản ghi #${id.slice(0, 8)} · Giờ hiển thị Việt Nam`}
      size="wide"
      busy={busy}
      dirty={
        !!detail &&
        (vehicleId !== (detail.vehicleId ?? "") ||
          rentalId !== (detail.rentalId ?? ""))
      }
      onClose={onClose}
      footer={
        detail && !terminal ? (
          <DialogActions
            formId="toll-review"
            busy={busy}
            submitDisabled={loading}
            submitLabel={
              action === "record"
                ? "Ghi chi phí đã duyệt"
                : action === "ignore"
                  ? "Bỏ qua có lý do"
                  : "Xác nhận liên kết"
            }
          />
        ) : (
          <Button type="button" variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        )
      }
    >
      {loading && <p role="status">Đang tải dữ liệu đối soát…</p>}
      {error && (
        <div role="alert">
          <p className="notice notice-danger">{error}</p>
          {!detail && (
            <Button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              <Icon name="retry" />
              Thử tải lại
            </Button>
          )}
        </div>
      )}
      {detail && (
        <>
          <dl className="detail-list">
            <div>
              <dt>Biển số bảng kê</dt>
              <dd>{detail.plate}</dd>
            </div>
            <div>
              <dt>Thời điểm qua trạm</dt>
              <dd>{formatDate(detail.occurredAt)}</dd>
            </div>
            <div>
              <dt>Số tiền</dt>
              <dd>{commercialMoney(detail.amount)}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                <Badge tone={terminal ? "success" : "neutral"}>
                  {tollStatusLabels[
                    detail.status as keyof typeof tollStatusLabels
                  ] ?? detail.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>Nguồn / mã</dt>
              <dd>
                {detail.source} · {detail.externalReference || "Không có mã"}
              </dd>
            </div>
            <div>
              <dt>Trạm</dt>
              <dd>{detail.station || "Không ghi trạm"}</dd>
            </div>
          </dl>
          {detail.description && (
            <p className="toll-description">{detail.description}</p>
          )}
          <div className="toll-links">
            {detail.vehicleId && (
              <Link href={`/app/vehicles/${detail.vehicleId}`}>
                Xe đã xác nhận #{detail.vehicleId.slice(0, 8)}
              </Link>
            )}
            {detail.rentalId && (
              <Link href={`/app/rentals/${detail.rentalId}`}>
                Hợp đồng #{detail.rentalId.slice(0, 8)}
              </Link>
            )}
            {detail.movementId && (
              <Link href={`/app/commercial/${detail.movementId}`}>
                Giao dịch chi phí #{detail.movementId.slice(0, 8)}
              </Link>
            )}
          </div>
          {detail.movementId && (
            <p className="notice notice-info">
              Chi phí đã ghi vào Commercial Core (
              {detail.movementStatus ?? "kiểm tra tại sổ giao dịch"}).
              {detail.reversedBy
                ? " Giao dịch đã được đảo; dòng nguồn vẫn liên kết bản gốc và không tự ghi chi lần nữa."
                : " Sửa sai bằng quy trình đảo có lý do trong sổ giao dịch."}
            </p>
          )}
          {!!detail.possibleDuplicateMovementIds.length && (
            <div className="notice notice-warning">
              <strong>Có chi phí TOLL gần giống cần kiểm tra</strong>
              <p>
                Không tự gộp với bản ghi thủ công. Chỉ xác nhận ghi thêm sau khi
                đã xem từng giao dịch.
              </p>
              <div className="toll-links">
                {detail.possibleDuplicateMovementIds.map((movementId) => (
                  <Link
                    key={movementId}
                    href={`/app/commercial/${movementId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Xem giao dịch #{movementId.slice(0, 8)}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {detail.suggestion.ambiguous && (
            <p className="notice notice-warning">
              Gợi ý hiện tại có nhiều khả năng hoặc có dòng phí tương tự. Kiểm
              tra bảng kê và liên kết thủ công; ghi chi phí cần xác nhận riêng,
              không dùng ghi hàng loạt.
            </p>
          )}
          {!terminal && (
            <>
              <label className="form-field">
                Thao tác
                <Select
                  value={action}
                  disabled={busy}
                  onChange={(event) => {
                    setAction(event.target.value);
                    setPicker(null);
                  }}
                >
                  <option value="review">
                    Xác nhận / thay đổi xe và hợp đồng
                  </option>
                  <option value="ignore">Bỏ qua dòng không sử dụng</option>
                  {detail.status === "MATCHED" && (
                    <option value="record">Ghi chi phí TOLL đã duyệt</option>
                  )}
                </Select>
              </label>
              {action === "review" && (
                <section className="toll-section">
                  <p className="quiet">
                    Gợi ý dựa trên biển số và thời gian thuê thực tế, không xác
                    định trách nhiệm người thuê. Mọi thay đổi thủ công phải ghi
                    rõ lý do.
                  </p>
                  <p>
                    {detail.suggestion.ambiguous
                      ? "Có nhiều hợp đồng phù hợp; cần chọn thủ công."
                      : detail.suggestion.vehicleId
                        ? `Xe gợi ý: ${detail.suggestion.vehiclePlate ?? detail.plate}${detail.suggestion.rentalId ? ` · Hợp đồng #${detail.suggestion.rentalId.slice(0, 8)}` : " · Chưa có hợp đồng phù hợp"}`
                        : "Chưa tìm thấy xe theo biển số này."}
                  </p>
                  {!!detail.suggestion.rentalCandidates.length && (
                    <div className="toll-links">
                      {detail.suggestion.rentalCandidates.map((rental) => (
                        <Link
                          key={rental}
                          href={`/app/rentals/${rental}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Kiểm tra hợp đồng #{rental.slice(0, 8)}
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="rental-form-actions">
                    {!!detail.suggestion.vehicleId &&
                      !detail.suggestion.ambiguous && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setVehicleId(detail.suggestion.vehicleId!);
                            setRentalId(detail.suggestion.rentalId ?? "");
                            setPicker(null);
                          }}
                        >
                          <Icon name="check" />
                          Dùng liên kết gợi ý
                        </Button>
                      )}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        setPicker(picker === "vehicle" ? null : "vehicle")
                      }
                    >
                      <Icon name="car" />
                      Chọn xe
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy || !vehicleId}
                      onClick={() =>
                        setPicker(picker === "rental" ? null : "rental")
                      }
                    >
                      <Icon name="rental" />
                      Chọn hợp đồng của xe
                    </Button>
                    {rentalId && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setRentalId("")}
                      >
                        Bỏ liên kết hợp đồng
                      </Button>
                    )}
                  </div>
                  <p>
                    Đang chọn:{" "}
                    {vehicleId
                      ? `Xe #${vehicleId.slice(0, 8)}`
                      : "Chưa chọn xe"}
                    {rentalId
                      ? ` · Hợp đồng #${rentalId.slice(0, 8)}`
                      : " · Không gắn hợp đồng"}
                  </p>
                  {picker === "vehicle" && (
                    <RecordPicker<Vehicle>
                      businessId={businessId}
                      path="/vehicles?sort=licensePlate&order=asc"
                      title="Chọn xe đối soát"
                      selected={vehicleId}
                      disabled={busy}
                      onSelect={(item) => {
                        setVehicleId(item?.id ?? "");
                        setRentalId("");
                      }}
                      render={(item) => (
                        <>
                          <strong>{item.licensePlate}</strong>
                          <small>
                            {item.make} {item.model}
                          </small>
                        </>
                      )}
                    />
                  )}
                  {picker === "rental" && vehicleId && (
                    <RecordPicker<Rental>
                      key={vehicleId}
                      businessId={businessId}
                      path={`/rentals?vehicleId=${vehicleId}&sort=createdAt&order=desc`}
                      title="Chọn hợp đồng đối soát"
                      selected={rentalId}
                      disabled={busy}
                      onSelect={(item) => {
                        if (
                          item &&
                          !["ACTIVE", "COMPLETED"].includes(item.status)
                        ) {
                          setError(
                            "Chỉ liên kết hợp đồng đã bàn giao hoặc đã hoàn tất. Hợp đồng nháp, đặt trước hoặc đã hủy không phù hợp.",
                          );
                          return;
                        }
                        setError("");
                        setRentalId(item?.id ?? "");
                      }}
                      render={(item) => (
                        <>
                          <strong>
                            {item.vehicle.licensePlate} · #{item.id.slice(0, 8)}
                          </strong>
                          <small>
                            {item.status} · {item.customer.name}
                          </small>
                        </>
                      )}
                    />
                  )}
                </section>
              )}
              {action === "record" && (
                <p className="notice notice-warning">
                  Ghi một khoản chi phí TOLL của doanh nghiệp bằng{" "}
                  {commercialMoney(detail.amount)}. Không tạo khoản phải thu
                  khách thuê, không trừ cọc và không xác nhận thanh toán ngân
                  hàng.
                </p>
              )}
              <form
                id="toll-review"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (saving.current) return;
                  setError("");
                  const data = new FormData(event.currentTarget),
                    reason = String(data.get("reason") ?? "").trim();
                  if (!reason || data.get("confirmed") !== "on") {
                    setError("Nhập lý do và xác nhận nội dung trước khi lưu.");
                    return;
                  }
                  if (action === "review" && !vehicleId) {
                    setError("Chọn xe trước khi xác nhận liên kết.");
                    return;
                  }
                  saving.current = true;
                  setBusy(true);
                  const controller = new AbortController();
                  active.current = controller;
                  try {
                    await tollRequest<Toll>(
                      businessId,
                      `/tolls/${id}/${action === "record" ? "record" : "review"}`,
                      action === "record" ? "POST" : "PATCH",
                      action === "record"
                        ? {
                            version: detail.version,
                            reason,
                            acknowledgePossibleDuplicate:
                              data.get("duplicateAcknowledged") === "on",
                          }
                        : {
                            version: detail.version,
                            reason,
                            vehicleId: vehicleId || null,
                            rentalId: rentalId || null,
                            ignore: action === "ignore",
                          },
                      controller.signal,
                    );
                    if (controller.signal.aborted) return;
                    onSaved(
                      action === "record"
                        ? "Đã ghi chi phí TOLL vào sổ giao dịch."
                        : action === "ignore"
                          ? "Đã bỏ qua dòng phí và lưu lý do."
                          : "Đã xác nhận liên kết; chưa ghi chi phí.",
                    );
                    onClose();
                  } catch (error) {
                    if (!controller.signal.aborted) {
                      if (error instanceof TollError && error.status === 401)
                        router.replace("/login");
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Chưa lưu được đối soát.",
                      );
                    }
                  } finally {
                    saving.current = false;
                    if (!controller.signal.aborted) setBusy(false);
                  }
                }}
              >
                <fieldset className="form-fieldset" disabled={busy}>
                  <label className="form-field">
                    Lý do / căn cứ kiểm tra
                    <Textarea
                      name="reason"
                      required
                      rows={3}
                      maxLength={2000}
                      placeholder="Nêu căn cứ xác nhận, thay đổi liên kết, bỏ qua hoặc phê duyệt chi phí."
                    />
                  </label>
                  {action === "record" &&
                    (!!detail.possibleDuplicateMovementIds.length ||
                      detail.suggestion.ambiguous) && (
                      <label className="rental-checkbox">
                        <Input
                          type="checkbox"
                          name="duplicateAcknowledged"
                          required
                        />
                        Tôi đã kiểm tra chi phí gần giống hoặc gợi ý chưa rõ,
                        xác nhận liên kết đã chọn và vẫn phê duyệt khoản chi
                        riêng này.
                      </label>
                    )}
                  <label className="rental-checkbox">
                    <Input type="checkbox" name="confirmed" required />
                    Tôi xác nhận thao tác và lý do đã nhập.
                  </label>
                </fieldset>
              </form>
            </>
          )}
          <section className="toll-section">
            <h3>Lịch sử đối soát · 100 lần gần nhất</h3>
            {detail.history.length ? (
              <ol className="toll-history">
                {detail.history.map((event) => (
                  <li key={event.id}>
                    <strong>{event.action}</strong> ·{" "}
                    {formatDate(event.createdAt)}
                    <p>{event.reason || "Nhập từ bảng kê CSV"}</p>
                    <small>
                      Phiên bản {event.version} ·{" "}
                      {tollStatusLabels[
                        event.status as keyof typeof tollStatusLabels
                      ] ?? event.status}
                    </small>
                    <div className="toll-links">
                      {event.vehicleId && (
                        <Link href={`/app/vehicles/${event.vehicleId}`}>
                          Xe #{event.vehicleId.slice(0, 8)}
                        </Link>
                      )}
                      {event.rentalId && (
                        <Link href={`/app/rentals/${event.rentalId}`}>
                          Hợp đồng #{event.rentalId.slice(0, 8)}
                        </Link>
                      )}
                      {!event.vehicleId && (
                        <small>Chưa liên kết xe ở thời điểm này</small>
                      )}
                    </div>
                    <small>Người thực hiện #{event.actorId.slice(0, 8)}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="quiet">Chưa có lịch sử.</p>
            )}
          </section>
        </>
      )}
    </FormDialog>
  );
}
export function TollBulkDialog({
  rows,
  businessId,
  onClose,
  onSaved,
}: {
  rows: Toll[];
  businessId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null),
    saving = useRef(false);
  useEffect(() => () => active.current?.abort(), []);
  const eligible =
    rows.length > 0 && rows.length <= 20 && rows.every(bulkRecordable);
  return (
    <FormDialog
      title={`Ghi chi phí ${rows.length} dòng đã chọn`}
      description="Mỗi dòng phải được xác nhận riêng, gợi ý hiện tại rõ ràng và không có chi phí gần giống"
      busy={busy}
      onClose={onClose}
      footer={
        <DialogActions
          formId="toll-bulk"
          busy={busy}
          submitLabel="Ghi các chi phí đã duyệt"
          submitDisabled={!eligible}
        />
      }
    >
      {error && (
        <p role="alert" className="notice notice-danger">
          {error}
        </p>
      )}
      <ul className="toll-history">
        {rows.map((row) => (
          <li key={row.id}>
            <strong>
              {row.plate} · {commercialMoney(row.amount)}
            </strong>
            <small>
              {formatDate(row.occurredAt)} · {row.station || "Không ghi trạm"}
            </small>
          </li>
        ))}
      </ul>
      <p className="quiet">
        Server kiểm tra lại toàn bộ dòng và lưu trong cùng giao dịch. Nếu một
        dòng đã đổi hoặc không rõ liên kết, lượt ghi sẽ dừng để kiểm tra lại.
        Không tự thu tiền khách thuê hoặc trừ cọc.
      </p>
      <form
        id="toll-bulk"
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving.current || !eligible) return;
          setError("");
          const data = new FormData(event.currentTarget),
            reason = String(data.get("reason") ?? "").trim();
          if (!reason || data.get("confirmed") !== "on") {
            setError("Nhập lý do và xác nhận từng dòng đã chọn.");
            return;
          }
          const controller = new AbortController();
          active.current = controller;
          saving.current = true;
          setBusy(true);
          try {
            await tollRequest(
              businessId,
              "/tolls/record",
              "POST",
              {
                items: rows.map((row) => ({
                  id: row.id,
                  version: row.version,
                })),
                reason,
              },
              controller.signal,
            );
            if (controller.signal.aborted) return;
            onSaved(`Đã ghi chi phí cho ${rows.length} dòng phí được chọn.`);
            onClose();
          } catch (error) {
            if (!controller.signal.aborted) {
              if (error instanceof TollError && error.status === 401)
                router.replace("/login");
              setError(
                error instanceof Error
                  ? error.message
                  : "Chưa ghi được chi phí.",
              );
            }
          } finally {
            saving.current = false;
            if (!controller.signal.aborted) setBusy(false);
          }
        }}
      >
        <fieldset className="form-fieldset" disabled={busy}>
          <label className="form-field">
            Lý do phê duyệt
            <Textarea name="reason" required maxLength={2000} rows={3} />
          </label>
          <label className="rental-checkbox">
            <Input name="confirmed" type="checkbox" required />
            Tôi đã kiểm tra và phê duyệt từng dòng được chọn.
          </label>
        </fieldset>
      </form>
    </FormDialog>
  );
}
