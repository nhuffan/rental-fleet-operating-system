export const tollStatuses = [
  "UNMATCHED",
  "NEEDS_REVIEW",
  "MATCHED",
  "RECORDED",
  "IGNORED",
] as const;
export const tollStatusLabels = {
  UNMATCHED: "Chưa tìm thấy xe",
  NEEDS_REVIEW: "Cần đối soát",
  MATCHED: "Đã xác nhận liên kết",
  RECORDED: "Đã ghi chi phí",
  IGNORED: "Đã bỏ qua",
} as const;
export function bulkRecordable(item: {
  status: string;
  vehicleId: string | null;
  rentalId: string | null;
  suggestion: {
    vehicleId: string | null;
    rentalId: string | null;
    ambiguous: boolean;
  };
  possibleDuplicateMovementIds: string[];
}) {
  return (
    item.status === "MATCHED" &&
    !!item.vehicleId &&
    !!item.rentalId &&
    !item.suggestion.ambiguous &&
    item.suggestion.vehicleId === item.vehicleId &&
    item.suggestion.rentalId === item.rentalId &&
    item.possibleDuplicateMovementIds.length === 0
  );
}
/** Only the first CSV record is read here to label column indexes. The server
 * owns parsing, validation and reconciliation for every data row. */
export function csvHeaders(text: string, delimiter: string): string[] {
  if (![",", ";", "\t"].includes(delimiter))
    throw new Error("Chọn dấu phân cách hợp lệ.");
  const source = text.replace(/^\uFEFF/, "");
  const fields: string[] = [];
  let cell = "",
    quoted = false,
    closed = false;
  for (let index = 0; index <= source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === undefined)
        throw new Error("Dòng tiêu đề có dấu nháy chưa đóng.");
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += character;
    } else if (character === '"' && cell === "" && !closed) quoted = true;
    else if (
      character === delimiter ||
      character === "\n" ||
      character === "\r" ||
      character === undefined
    ) {
      fields.push(cell.trim());
      cell = "";
      closed = false;
      if (fields.length > 32) throw new Error("CSV tối đa 32 cột.");
      if (character !== delimiter) return fields;
    } else {
      if (closed || character === '"')
        throw new Error("Dòng tiêu đề có định dạng nháy không hợp lệ.");
      cell += character;
    }
    if (cell.length > 2000) throw new Error("Tên cột quá dài.");
  }
  return fields;
}
