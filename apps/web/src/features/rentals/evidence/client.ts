import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
const messages: Record<string, string> = {
  EVIDENCE_QUOTA_EXCEEDED:
    "Đã đạt giới hạn dung lượng. Chờ dọn upload tạm hoặc liên hệ Owner.",
  EVIDENCE_LIMIT_EXCEEDED:
    "Chứng cứ vượt giới hạn đã cấu hình của biên bản. Hãy bỏ bớt file.",
  EVIDENCE_UPLOAD_EXPIRED:
    "Phiên upload đã hết hạn. Hãy bỏ file này và chọn lại.",
  EVIDENCE_NOT_READY: "File chưa được kiểm tra xong. Hãy thử kiểm tra lại.",
  EVIDENCE_INVALID_MEDIA:
    "Server không chấp nhận nội dung file. Kiểm tra loại, kích thước, thời lượng và chọn lại.",
  EVIDENCE_NOT_CONFIGURED:
    "Chứng cứ ảnh/video chưa được cấu hình. Bạn vẫn có thể lập biên bản không có media.",
  EVIDENCE_INVALID_FILE:
    "Nội dung file không hợp lệ hoặc vượt giới hạn. Hãy chọn lại file khác.",
  EVIDENCE_INVALID_UPLOAD:
    "File chứng cứ chưa sẵn sàng hoặc không khớp với biên bản hiện tại.",
  EVIDENCE_VERIFYING:
    "Server đang kiểm tra file này. Chờ một lúc rồi thử kiểm tra lại.",
  EVIDENCE_UPLOAD_LOCKED: "Chứng cứ đã được gắn và khóa cùng biên bản.",
  EVIDENCE_IDEMPOTENCY_CONFLICT:
    "Phiên retry không khớp file ban đầu. Bỏ file này và chọn lại.",
  EVIDENCE_DISABLED:
    "Chứng cứ ảnh/video chưa được cấu hình. Bạn vẫn có thể lập biên bản không có media.",
  EVIDENCE_RETENTION_LOCKED:
    "Chứng cứ đang được xử lý xóa hoặc đã bị xóa. Tải lại trạng thái trước khi thay đổi giữ file.",
  EVIDENCE_RETENTION_VALIDATION:
    "Nhập lý do rõ ràng và xác nhận tranh chấp đã giải quyết trước khi gỡ giữ chứng cứ.",
  EVIDENCE_MEDIA_UNAVAILABLE:
    "File hiện không thể xem hoặc tải. Kiểm tra lại trạng thái lưu trữ của chứng cứ.",
  EVIDENCE_NOT_FOUND: "Không tìm thấy chứng cứ trong doanh nghiệp hiện tại.",
  INVALID_RENTAL_STATE:
    "Hợp đồng đã đổi trạng thái. Tải lại dữ liệu trước khi tiếp tục.",
};
export class EvidenceError extends Error {
  constructor(
    message: string,
    public readonly code = "",
    public readonly status = 0,
  ) {
    super(message);
  }
}
export async function evidenceRequest<T>(
  businessId: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const {
    data: { session },
  } = await browserClient().auth.getSession();
  if (!session) {
    throw new EvidenceError(
      "Phiên đăng nhập đã hết hạn.",
      "UNAUTHENTICATED",
      401,
    );
  }
  const response = await fetch(`${publicEnv().api}/api/v1${path}`, {
    method,
    cache: "no-store",
    signal,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "X-Business-Id": businessId,
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new EvidenceError(
      messages[payload.code] ??
        (response.status === 403
          ? "Bạn không có quyền truy cập chứng cứ này."
          : response.status === 503
            ? "Dịch vụ ảnh/video chưa sẵn sàng. Vui lòng thử lại sau."
            : `Không thể xử lý file (${payload.code ?? response.status}). Mã yêu cầu: ${payload.requestId ?? "—"}`),
      payload.code,
      response.status,
    );
  }
  return payload as T;
}
export function signedStorageUpload(
  signedUrl: string,
  blob: Blob,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const url = new URL(signedUrl);
  if (
    url.origin !== new URL(publicEnv().url).origin ||
    !url.pathname.startsWith("/storage/v1/object/upload/sign/")
  )
    throw new Error("Địa chỉ upload không hợp lệ.");
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    xhr.open("PUT", url.toString());
    xhr.timeout = 120000;
    xhr.setRequestHeader("apikey", publicEnv().key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? finish()
        : finish(
            new EvidenceError(
              xhr.status === 409 || xhr.status === 400
                ? "File có thể đã được upload. Đang cần kiểm tra lại."
                : "Upload chưa hoàn tất. Hãy thử lại.",
              "STORAGE_UPLOAD",
              xhr.status,
            ),
          );
    xhr.onerror = () =>
      finish(
        new EvidenceError(
          "Kết nối upload bị gián đoạn. Có thể thử lại.",
          "STORAGE_NETWORK",
        ),
      );
    xhr.ontimeout = () =>
      finish(
        new EvidenceError(
          "Upload quá thời gian. Có thể thử lại.",
          "STORAGE_TIMEOUT",
        ),
      );
    xhr.onabort = () => finish(new DOMException("Đã hủy", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    const form = new FormData();
    form.append("cacheControl", "60");
    form.append("", blob);
    if (signal.aborted) {
      finish(new DOMException("Đã hủy", "AbortError"));
      return;
    }
    xhr.send(form);
  });
}
