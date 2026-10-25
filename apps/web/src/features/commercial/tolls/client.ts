import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
const messages: Record<string, string> = {
  TOLL_BULK_REVIEW_REQUIRED:
    "Một số dòng cần xem lại liên kết hoặc chi phí gần giống. Tải lại và ghi riêng từng dòng sau khi kiểm tra.",
  TOLL_IMPORT_ROWS_INVALID:
    "Một số dòng được chọn không còn hợp lệ hoặc có xung đột. Tạo preview mới, kiểm tra lỗi từng dòng rồi nhập lại.",
  TOLL_IDEMPOTENCY_CONFLICT:
    "Lượt nhập đang retry không khớp nội dung ban đầu. Giữ nguyên file, cấu hình và dòng chọn khi retry; nếu thay đổi hãy tạo preview mới.",
  TOLL_NOT_FOUND: "Không tìm thấy dòng phí trong doanh nghiệp hiện tại.",
  TOLL_VERSION_CONFLICT:
    "Dòng phí đã đổi. Đóng cửa sổ, tải lại và kiểm tra trước khi lưu.",
  TOLL_STALE_VERSION:
    "Dòng phí đã đổi. Đóng cửa sổ, tải lại và kiểm tra trước khi lưu.",
  TOLL_ALREADY_RECORDED:
    "Dòng phí đã được ghi chi phí. Kiểm tra liên kết sổ giao dịch.",
  TOLL_DUPLICATE:
    "Dòng phí đã có trong doanh nghiệp. Xem preview mới trước khi nhập lại.",
  TOLL_PREVIEW_CHANGED:
    "Preview đã thay đổi. Quay lại kiểm tra và tạo preview mới.",
  TOLL_PREVIEW_MISMATCH:
    "Preview không khớp file hoặc cấu hình. Tạo preview mới trước khi nhập.",
  TOLL_POSSIBLE_DUPLICATE:
    "Có chi phí TOLL gần giống. Kiểm tra các giao dịch liên quan và xác nhận riêng từng dòng.",
  TOLL_BULK_NOT_ELIGIBLE:
    "Một số dòng không còn đủ điều kiện ghi hàng loạt. Tải lại và đối soát riêng từng dòng.",
  COMMERCIAL_CURRENCY_UNSUPPORTED:
    "Chi phí hiện chỉ hỗ trợ doanh nghiệp sử dụng VND.",
};
export class TollError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "",
  ) {
    super(message);
  }
}
export async function tollRequest<T>(
  businessId: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const {
    data: { session },
  } = await browserClient().auth.getSession();
  signal?.throwIfAborted();
  if (!session) throw new TollError("Phiên đăng nhập đã hết hạn.", 401);
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
    throw new TollError(
      messages[payload.code] ??
        (response.status === 403
          ? "Bạn không có quyền thực hiện đối soát trong doanh nghiệp này."
          : response.status === 413
            ? "CSV hoặc nội dung gửi vượt giới hạn. Chia file nhỏ hơn."
            : `${typeof payload.message === "string" && response.status < 500 ? payload.message : "Chưa xử lý được đối soát. Thử lại sau."} Mã yêu cầu: ${payload.requestId ?? "—"}`),
      response.status,
      payload.code,
    );
  return payload as T;
}
