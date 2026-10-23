import {
  pageNumber,
  queryString,
  text,
  validId,
  type SearchParams,
} from "@/lib/query";
const DAY = 24 * 60 * 60 * 1000;
export function tripFilters(params: SearchParams) {
  const now = new Date();
  const to = text(params.to, 40) || now.toISOString();
  const toMs = Date.parse(to);
  const from =
    text(params.from, 40) ||
    new Date(
      (Number.isFinite(toMs) ? toMs : now.getTime()) - DAY,
    ).toISOString();
  const vehicleId = text(params.vehicleId, 36);
  const rentalId = text(params.rentalId, 36);
  const filters = {
    page: pageNumber(params.page),
    limit: [20, 50, 100].includes(Number(params.limit))
      ? Number(params.limit)
      : 20,
    vehicleId,
    rentalId,
    from,
    to,
    sort: text(params.sort) === "asc" ? "asc" : "desc",
  };
  let error = "";
  const start = Date.parse(from);
  const end = Date.parse(to);
  if ((vehicleId && !validId(vehicleId)) || (rentalId && !validId(rentalId)))
    error = "Mã xe hoặc hợp đồng không hợp lệ. Hãy chọn lại từ danh mục.";
  else if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(from) ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(to)
  )
    error =
      "Khoảng thời gian không hợp lệ. Hãy chọn lại ngày bắt đầu và kết thúc.";
  else if (end > now.getTime() + 300000)
    error = "Thời gian kết thúc không được quá 5 phút trong tương lai.";
  else if (end <= start || end - start > 7 * DAY)
    error = "Chọn khoảng thời gian dương, tối đa 7 ngày cho mỗi lần tra cứu.";
  return { filters, error };
}
export type TripFilters = ReturnType<typeof tripFilters>["filters"];
export function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`
    : minutes
      ? `${minutes} phút`
      : `${Math.round(seconds)} giây`;
}
export function distanceLabel(meters: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(meters / 1000)} km`;
}
export const partialLabels: Record<string, string> = {
  IGNITION_CONFLICT: "Trạng thái ignition không nhất quán",
  GAP_BEFORE: "Bản tin trước cách xa về thời gian",
  GAP_AFTER: "Bản tin sau cách xa về thời gian",
  ASSIGNMENT_BOUNDARY: "Biên thay đổi thiết bị đã gắn",
  START_NOT_OBSERVED: "Chưa quan sát được điểm bắt đầu hành trình",
  END_NOT_OBSERVED: "Chưa quan sát được điểm kết thúc hành trình",
  RETENTION_WINDOW: "Khoảng tra cứu vượt giới hạn lưu trữ",
  RANGE_START: "Chỉ quan sát được dữ liệu trong cửa sổ tra cứu",
  INSUFFICIENT_POINTS: "Chưa đủ điểm để dựng tuyến",
  POSITION_JUMP: "Bỏ nối đoạn có bước nhảy vị trí",
};
export function partialLabel(reason: string) {
  return partialLabels[reason] ?? "Dữ liệu chưa đầy đủ";
}

export function rentalTripRange(
  startAt: string,
  endAt: string,
  now = new Date(),
) {
  const end = Math.min(Date.parse(endAt), now.getTime());
  const start = Math.max(Date.parse(startAt), end - 7 * DAY);
  return end > start
    ? { from: new Date(start).toISOString(), to: new Date(end).toISOString() }
    : null;
}

// This only restores user-supplied filters. The API still authorizes every query.
export function tripHistoryHref(id: unknown) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{20,600}$/.test(id))
    return "/app/trips";
  try {
    const data: unknown = JSON.parse(
      atob(id.replaceAll("-", "+").replaceAll("_", "/")),
    );
    if (!data || typeof data !== "object") return "/app/trips";
    const ref = data as Record<string, unknown>;
    if (
      ref.v !== 1 ||
      typeof ref.vehicleId !== "string" ||
      typeof ref.from !== "string" ||
      typeof ref.to !== "string"
    )
      return "/app/trips";
    const { filters, error } = tripFilters({
      vehicleId: ref.vehicleId,
      from: ref.from,
      to: ref.to,
    });
    if (
      error ||
      filters.vehicleId !== ref.vehicleId ||
      filters.from !== ref.from ||
      filters.to !== ref.to
    )
      return "/app/trips";
    return `/app/trips?${queryString({ vehicleId: filters.vehicleId, from: filters.from, to: filters.to })}`;
  } catch {
    return "/app/trips";
  }
}
