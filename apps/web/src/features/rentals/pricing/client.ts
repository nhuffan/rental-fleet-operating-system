import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";

const messages: Record<string, string> = {
  RATE_OVERLAP:
    "Khoảng hiệu lực trùng bảng giá đang hoạt động trong cùng phạm vi. Đổi thời gian hoặc ngưng bảng giá cũ.",
  RATE_VERSION_CHANGED: "Bảng giá đã thay đổi. Tải lại dữ liệu trước khi lưu.",
  RATE_IN_USE:
    "Bảng giá đã có lịch sử báo giá. Ngưng hoạt động thay vì xóa để giữ lịch sử.",
  PRICING_PREVIEW_CHANGED:
    "Bảng giá hoặc lịch thuê đã thay đổi. Tải lại báo giá và xem lại trước khi xác nhận.",
  PRICING_REASON_REQUIRED: "Nhập lý do rõ ràng cho giá thỏa thuận.",
  PRICING_MANUAL_AMOUNT_REQUIRED:
    "Chưa có giá tính được. Nhập giá thỏa thuận và lý do.",
  PRICING_AMOUNT_EXCEEDED:
    "Tiền thuê vượt giới hạn hợp đồng. Điều chỉnh thời gian hoặc thỏa thuận giá trong giới hạn.",
  PRICING_RATE_OVERLAP:
    "Khoảng hiệu lực trùng với một bảng giá đang hoạt động trong cùng phạm vi. Hãy đổi thời gian hoặc ngưng bảng giá cũ.",
  PRICING_VERSION_CONFLICT:
    "Bảng giá đã thay đổi. Tải lại dữ liệu trước khi lưu.",
  PRICING_STALE_QUOTE:
    "Bảng giá hoặc lịch thuê đã thay đổi. Tải lại báo giá và xem lại trước khi xác nhận.",
  PRICING_RATE_IN_USE:
    "Bảng giá đã có lịch sử báo giá. Ngưng hoạt động thay vì xóa để giữ lịch sử.",
  PRICING_CURRENCY_UNSUPPORTED:
    "Bảng giá và báo giá hiện chỉ hỗ trợ doanh nghiệp dùng VND.",
  PRICING_RATE_NOT_FOUND:
    "Không tìm thấy bảng giá trong doanh nghiệp hiện tại.",
  PRICING_OVERRIDE_REASON_REQUIRED: "Nhập lý do rõ ràng cho giá thỏa thuận.",
};
export class PricingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "",
  ) {
    super(message);
  }
}
export async function pricingRequest<T>(
  businessId: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const {
    data: { session },
  } = await browserClient().auth.getSession();
  signal?.throwIfAborted();
  if (!session) throw new PricingError("Phiên đăng nhập đã hết hạn.", 401);
  const response = await fetch(`${publicEnv().api}/api/v1${path}`, {
    method,
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "X-Business-Id": businessId,
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new PricingError(
      messages[payload.code] ??
        (response.status === 403
          ? "Bạn không có quyền quản lý giá trong doanh nghiệp này."
          : `Chưa thể xử lý bảng giá (${payload.code ?? response.status}). Mã yêu cầu: ${payload.requestId ?? "—"}`),
      response.status,
      payload.code,
    );
  return payload as T;
}
