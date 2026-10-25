"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DialogActions, FormDialog } from "@/components/ui/form-dialog";
import { Badge, Button, Input, Select } from "@/components/ui/primitives";
import { DataTable } from "@/components/data-display/table";
import { Icon } from "@/components/ui/icon";
import { commercialMoney } from "../query";
import { formatDate } from "@/lib/query";
import { csvHeaders } from "./policy";
import { tollRequest, TollError } from "./client";
import type { TollImportInput, TollImportResult, TollPreview } from "./types";
const columns = [
  ["plate", "Biển số", true],
  ["occurredAt", "Thời điểm qua trạm", true],
  ["amount", "Số tiền", true],
  ["externalReference", "Mã giao dịch", false],
  ["station", "Trạm", false],
  ["description", "Mô tả", false],
] as const;
const previewLabels = {
  VALID: "Có thể nhập",
  INVALID: "Không hợp lệ",
  DUPLICATE: "Đã có / trùng",
  CONFLICT: "Cần kiểm tra trùng",
};
export function TollImportDialog({
  businessId,
  onClose,
  onSaved,
}: {
  businessId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [delimiter, setDelimiter] = useState<TollImportInput["delimiter"]>(",");
  const [source, setSource] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dateFormat, setDateFormat] =
    useState<TollImportInput["dateFormat"]>("ISO_OFFSET");
  const [timezoneOffset, setTimezoneOffset] = useState("+07:00");
  const [amountFormat, setAmountFormat] =
    useState<TollImportInput["amountFormat"]>("INTEGER");
  const [preview, setPreview] = useState<TollPreview | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const running = useRef(false);
  const idempotency = useRef<string | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  let headers: string[] = [],
    headerError = "";
  if (csv) {
    try {
      headers = csvHeaders(csv, delimiter);
    } catch (error) {
      headerError =
        error instanceof Error ? error.message : "Chưa đọc được dòng tiêu đề.";
    }
  }
  function changeSelection(next: number[]) {
    setSelection(next);
    idempotency.current = crypto.randomUUID();
  }
  async function readFile(file?: File) {
    if (!file || running.current) return;
    setError("");
    setPreview(null);
    setMapping({});
    setSelection([]);
    setCsv("");
    setFileName("");
    if (file.size > 64 * 1024) {
      setError(
        "CSV tối đa 64 KiB và 200 dòng dữ liệu. Chia bảng kê thành file nhỏ hơn.",
      );
      return;
    }
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (controller.signal.aborted) return;
      setCsv(text);
      setFileName(file.name);
      idempotency.current = null;
    } catch {
      if (!controller.signal.aborted)
        setError(
          "Chỉ nhận CSV UTF-8 (có thể có BOM). Xuất lại CSV UTF-8 rồi chọn file.",
        );
    }
  }
  function importInput(): TollImportInput {
    const result: Record<string, number> = {};
    for (const [name, , required] of columns) {
      if (mapping[name] !== undefined && mapping[name] !== "")
        result[name] = Number(mapping[name]);
      else if (required)
        throw new Error("Chọn đầy đủ cột biển số, thời điểm và số tiền.");
    }
    if (new Set(Object.values(result)).size !== Object.values(result).length)
      throw new Error("Mỗi nội dung cần dùng một cột khác nhau.");
    return {
      csv,
      source: source.trim(),
      delimiter,
      dateFormat,
      timezoneOffset,
      amountFormat,
      mapping: result as TollImportInput["mapping"],
    };
  }
  async function submit(confirmed: boolean) {
    if (running.current) return;
    setError("");
    try {
      const input = importInput();
      if (!input.csv || !input.source || headerError)
        throw new Error(
          headerError || "Chọn file CSV và nhập tên nguồn bảng kê.",
        );
      if (preview && (!confirmed || !selection.length))
        throw new Error(
          "Chọn dòng hợp lệ và xác nhận nội dung trước khi nhập.",
        );
      running.current = true;
      setBusy(true);
      const controller = new AbortController();
      active.current?.abort();
      active.current = controller;
      if (!preview) {
        const response = await tollRequest<TollPreview>(
          businessId,
          "/tolls/imports/preview",
          "POST",
          input,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setPreview(response);
        setSelection(
          response.rows
            .filter((row) => row.status === "VALID")
            .map((row) => row.rowNumber),
        );
        idempotency.current = crypto.randomUUID();
      } else {
        idempotency.current ??= crypto.randomUUID();
        const response = await tollRequest<TollImportResult>(
          businessId,
          "/tolls/imports",
          "POST",
          {
            ...input,
            previewHash: preview.previewHash,
            idempotencyKey: idempotency.current,
            rowNumbers: selection,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        onSaved(
          `Đã nhập ${response.importedCount} dòng phí; bỏ qua ${response.duplicateCount} dòng đã có${response.idempotent ? " (xác nhận lại lượt nhập trước)" : ""}. Chưa ghi chi phí vào sổ giao dịch.`,
        );
        onClose();
      }
    } catch (error) {
      if (!active.current?.signal.aborted) {
        if (error instanceof TollError && error.status === 401)
          router.replace("/login");
        setError(
          error instanceof Error ? error.message : "Chưa xử lý được CSV.",
        );
      }
    } finally {
      running.current = false;
      if (!active.current?.signal.aborted) setBusy(false);
    }
  }
  return (
    <FormDialog
      title="Nhập bảng kê phí đường bộ"
      description="CSV do Owner cung cấp · Không kết nối VETC trực tiếp"
      size="wide"
      dirty={!!csv}
      busy={busy}
      onClose={onClose}
      footer={
        <DialogActions
          formId="toll-import"
          busy={busy}
          submitLabel={
            preview
              ? `Nhập ${selection.length} dòng đã chọn`
              : "Kiểm tra & xem preview"
          }
          submitIcon={preview ? "check" : "search"}
          submitDisabled={
            !!headerError || !csv || (preview !== null && !selection.length)
          }
        />
      }
    >
      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}
      <p className="quiet">
        File chỉ được xử lý để chuẩn hóa dữ liệu, không lưu CSV gốc lâu dài.
        Preview chưa ghi dữ liệu. CSV không tự chứng minh đã thanh toán và không
        tạo khoản thu khách thuê hoặc trừ cọc.
      </p>
      <form
        id="toll-import"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(
            new FormData(event.currentTarget).get("confirmed") === "on",
          );
        }}
      >
        {!preview ? (
          <fieldset className="form-fieldset" disabled={busy}>
            <label className="form-field">
              File CSV UTF-8 (tối đa 64 KiB / 200 dòng)
              <Input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(event) => {
                  void readFile(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <small>
                {fileName ||
                  "Dòng đầu tiên là tiêu đề; tối đa 32 cột. Không dùng file Excel .xlsx."}
              </small>
            </label>
            <div className="form-grid">
              <label className="form-field">
                Tên nguồn bảng kê
                <Input
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  required
                  maxLength={80}
                  placeholder="Ví dụ: vetc_csv hoặc bảng kê nhà cung cấp"
                />
                <small>
                  Dùng cùng tên nguồn qua các lần nhập để phát hiện dòng trùng.
                </small>
              </label>
              <label className="form-field">
                Dấu phân cách
                <Select
                  value={delimiter}
                  onChange={(event) => {
                    setDelimiter(event.target.value as typeof delimiter);
                    setMapping({});
                  }}
                >
                  <option value=",">Dấu phẩy (,)</option>
                  <option value=";">Dấu chấm phẩy (;)</option>
                  <option value={"\t"}>Tab</option>
                </Select>
              </label>
              <label className="form-field">
                Định dạng ngày giờ
                <Select
                  value={dateFormat}
                  onChange={(event) =>
                    setDateFormat(event.target.value as typeof dateFormat)
                  }
                >
                  <option value="ISO_OFFSET">
                    ISO có múi giờ: 2026-10-25T08:30:00+07:00
                  </option>
                  <option value="ISO_LOCAL">
                    Năm-tháng-ngày: 2026-10-25 08:30:00
                  </option>
                  <option value="DMY_LOCAL">
                    Ngày/tháng/năm: 25/10/2026 08:30:00
                  </option>
                </Select>
              </label>
              <label className="form-field">
                Số tiền nguyên VND
                <Select
                  value={amountFormat}
                  onChange={(event) =>
                    setAmountFormat(event.target.value as typeof amountFormat)
                  }
                >
                  <option value="INTEGER">Không phân cách: 35000</option>
                  <option value="DOT_GROUPED">
                    Dấu chấm hàng nghìn: 35.000
                  </option>
                  <option value="COMMA_GROUPED">
                    Dấu phẩy hàng nghìn: 35,000
                  </option>
                </Select>
              </label>
              {dateFormat !== "ISO_OFFSET" && (
                <label className="form-field">
                  Múi giờ của bảng kê
                  <Input
                    value={timezoneOffset}
                    onChange={(event) => setTimezoneOffset(event.target.value)}
                    pattern="[+-][0-9]{2}:[0-9]{2}"
                    required
                    placeholder="+07:00"
                  />
                  <small>
                    Offset cố định dùng để chuyển sang UTC, không đoán múi giờ.
                  </small>
                </label>
              )}
            </div>
            {headerError && (
              <p role="alert" className="notice notice-warning">
                {headerError}
              </p>
            )}
            {!!headers.length && (
              <section className="toll-section">
                <h3>Map cột dữ liệu</h3>
                <p className="quiet">
                  Chọn cột cụ thể; các tiêu đề lặp lại được phân biệt bằng số
                  thứ tự cột.
                </p>
                <div className="form-grid">
                  {columns.map(([name, label, required]) => (
                    <label key={name} className="form-field">
                      {label}
                      {required ? " *" : " (tùy chọn)"}
                      <Select
                        required={required}
                        value={mapping[name] ?? ""}
                        onChange={(event) =>
                          setMapping((value) => ({
                            ...value,
                            [name]: event.target.value,
                          }))
                        }
                      >
                        <option value="">
                          {required ? "Chọn cột" : "Không có cột này"}
                        </option>
                        {headers.map((header, index) => (
                          <option key={index} value={String(index)}>
                            Cột {index + 1}: {header || "(không tên)"}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ))}
                </div>
              </section>
            )}
          </fieldset>
        ) : (
          <fieldset className="form-fieldset" disabled={busy}>
            <div className="toll-preview-summary" role="status">
              <strong>{preview.summary.total} dòng</strong>
              <span>{preview.summary.valid} hợp lệ</span>
              <span>{preview.summary.invalid} lỗi</span>
              <span>{preview.summary.duplicate} trùng</span>
              <span>{preview.summary.conflict} xung đột</span>
            </div>
            <p className="quiet">
              Chỉ nhập các dòng hợp lệ đã chọn. Dòng trùng/xung đột giữ ngoài
              lượt nhập để Owner kiểm tra bảng kê; import không xác nhận xe/hợp
              đồng và chưa ghi chi phí.
            </p>
            <div className="toll-preview-table">
              <DataTable
                caption="Preview từng dòng CSV"
                rows={preview.rows.map((row) => ({
                  ...row,
                  id: String(row.rowNumber),
                }))}
                columns={[
                  {
                    key: "select",
                    label: "Chọn",
                    render: (row) => (
                      <Input
                        type="checkbox"
                        aria-label={`Nhập dòng ${row.rowNumber}`}
                        disabled={row.status !== "VALID"}
                        checked={selection.includes(row.rowNumber)}
                        onChange={(event) =>
                          changeSelection(
                            event.target.checked
                              ? [...selection, row.rowNumber]
                              : selection.filter(
                                  (value) => value !== row.rowNumber,
                                ),
                          )
                        }
                      />
                    ),
                  },
                  {
                    key: "row",
                    label: "Dòng",
                    render: (row) => (
                      <>
                        {row.rowNumber}
                        <small className="fleet-cell-meta">
                          <Badge
                            tone={
                              row.status === "VALID" ? "success" : "warning"
                            }
                          >
                            {previewLabels[
                              row.status as keyof typeof previewLabels
                            ] ?? row.status}
                          </Badge>
                        </small>
                      </>
                    ),
                  },
                  {
                    key: "data",
                    label: "Xe / thời điểm",
                    render: (row) =>
                      row.normalized ? (
                        <>
                          <strong>{row.normalized.plate}</strong>
                          <small className="fleet-cell-meta">
                            {formatDate(row.normalized.occurredAt)}
                          </small>
                          {row.normalized.station}
                        </>
                      ) : (
                        "Không chuẩn hóa được"
                      ),
                  },
                  {
                    key: "amount",
                    label: "Số tiền",
                    render: (row) =>
                      row.normalized
                        ? commercialMoney(row.normalized.amount)
                        : "—",
                  },
                  {
                    key: "review",
                    label: "Kiểm tra",
                    render: (row) => (
                      <>
                        {row.errors.join(" · ") ||
                          (row.suggestion.ambiguous
                            ? "Liên kết không rõ ràng"
                            : row.suggestion.vehicleId
                              ? "Có xe gợi ý; cần Owner xác nhận"
                              : "Chưa có xe phù hợp")}
                        {!!row.possibleDuplicateMovementIds.length && (
                          <p className="quiet">
                            Có {row.possibleDuplicateMovementIds.length} chi phí
                            gần giống cần kiểm tra.
                          </p>
                        )}
                      </>
                    ),
                  },
                ]}
              />
            </div>
            <label className="rental-checkbox">
              <Input name="confirmed" type="checkbox" required />
              Tôi đã kiểm tra các dòng được chọn và hiểu đây là dữ liệu bảng kê
              cần đối soát tiếp.
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPreview(null);
                setError("");
              }}
            >
              <Icon name="retry" />
              Quay lại map cột
            </Button>
          </fieldset>
        )}
      </form>
    </FormDialog>
  );
}
