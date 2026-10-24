import type { RentalInspection } from "./types";

export const conditionLabels = {
  GOOD: "Tốt, không ghi nhận hư hỏng",
  DAMAGED: "Có hư hỏng",
} as const;
export const checklistLabels = {
  PRESENT: "Có, đã kiểm tra",
  MISSING: "Thiếu",
  NOT_APPLICABLE: "Không áp dụng",
} as const;
export const inspectionItems = [
  { name: "spareTire", label: "Lốp dự phòng" },
  { name: "tools", label: "Bộ dụng cụ" },
  { name: "registrationDocument", label: "Giấy đăng ký xe" },
  { name: "insuranceDocument", label: "Giấy bảo hiểm" },
  { name: "keys", label: "Chìa khóa" },
] as const;
export function inspectionStatus(value: RentalInspection["spareTire"]) {
  return checklistLabels[value];
}
