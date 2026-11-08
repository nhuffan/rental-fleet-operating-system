import { pageNumber, text, validId, type SearchParams } from "@/lib/query";
export const kindLabels = {
  RENTAL_OVERDUE: "Quá hạn trả xe",
  RENTAL_DUE_SOON: "Sắp đến hạn trả xe",
  GPS_STALE: "Bản tin GPS TEST bị trễ",
  VEHICLE_REGISTRATION_DUE: "Đăng kiểm đến hạn",
  VEHICLE_INSURANCE_DUE: "Bảo hiểm đến hạn",
  VEHICLE_MAINTENANCE_DUE: "Bảo dưỡng đến hạn",
};
export const severityLabels = {
  CRITICAL: "Cần xử lý",
  WARNING: "Cần theo dõi",
};
export function alertFilters(params: SearchParams) {
  const kind = text(params.kind),
    severity = text(params.severity);
  return {
    page: pageNumber(params.page),
    limit: 20,
    kind: Object.hasOwn(kindLabels, kind) ? kind : "",
    severity: Object.hasOwn(severityLabels, severity) ? severity : "",
    vehicleId: validId(text(params.vehicleId)) ? text(params.vehicleId) : "",
    rentalId: validId(text(params.rentalId)) ? text(params.rentalId) : "",
  };
}
export type AlertFilters = ReturnType<typeof alertFilters>;
export function elapsed(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 1) return "dưới 1 phút";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ ${minutes % 60} phút`;
  return `${Math.floor(hours / 24)} ngày ${hours % 24} giờ`;
}
