"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { components } from "@rental-fleet/contracts/src/openapi";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
type Schemas = components["schemas"];
export type BusinessUpdate = Schemas["BusinessUpdate"];
export type SettingsUpdate = Schemas["SettingsUpdate"];
export type MemberCreate = Schemas["MemberCreate"];
export type MemberUpdate = Schemas["MemberUpdate"];
export type BranchCreate = Schemas["BranchCreate"];
export type BranchUpdate = Schemas["BranchUpdate"];
type VehicleCreate = Schemas["VehicleCreate"];
type VehicleUpdate = Schemas["VehicleUpdate"];
type GpsDeviceCreate = Schemas["GpsDeviceCreate"];
type GpsDeviceUpdate = Schemas["GpsDeviceUpdate"];
type DeviceAssignmentCreate = Schemas["DeviceAssignmentCreate"];
type ServiceRecordCreate = Schemas["ServiceRecordCreate"];
type CustomerCreate = Schemas["CustomerCreate"];
type CustomerUpdate = Schemas["CustomerUpdate"];
type RentalCreate = Schemas["RentalCreate"];
type RentalUpdate = Schemas["RentalUpdate"];
type RentalHandover = Schemas["RentalHandover"];
type RentalExtend = Schemas["RentalExtend"];
type RentalReturn = Schemas["RentalReturn"];
type RentalCancel = Schemas["RentalCancel"];
type CommercialMovementCreate = Schemas["CommercialMovementCreate"];
type CommercialMovementReverse = Schemas["CommercialMovementReverse"];
type Mutation =
  | {
      path: "/commercial/movements";
      body: CommercialMovementCreate;
      method: "POST";
    }
  | {
      path: `/commercial/movements/${string}/reverse`;
      body: CommercialMovementReverse;
      method: "POST";
    }
  | { path: "/customers"; body: CustomerCreate; method: "POST" }
  | { path: `/customers/${string}/portal-access`; body?: never; method: "POST" }
  | { path: `/customers/${string}`; body: CustomerUpdate; method?: "PATCH" }
  | { path: "/rentals"; body: RentalCreate; method: "POST" }
  | { path: `/rentals/${string}`; body: RentalUpdate; method?: "PATCH" }
  | { path: `/rentals/${string}/contract`; body?: never; method: "POST" }
  | { path: `/rentals/${string}/reserve`; body?: never; method: "POST" }
  | {
      path: `/rentals/${string}/handover`;
      body: RentalHandover;
      method: "POST";
    }
  | { path: `/rentals/${string}/extend`; body: RentalExtend; method: "POST" }
  | { path: `/rentals/${string}/return`; body: RentalReturn; method: "POST" }
  | { path: `/rentals/${string}/cancel`; body: RentalCancel; method: "POST" }
  | { path: "/businesses/current"; body: BusinessUpdate; method?: "PATCH" }
  | { path: "/settings"; body: SettingsUpdate; method?: "PATCH" }
  | { path: "/memberships"; body: MemberCreate; method: "POST" }
  | { path: `/memberships/${string}`; body: MemberUpdate; method?: "PATCH" }
  | { path: "/branches"; body: BranchCreate; method: "POST" }
  | { path: `/branches/${string}`; body: BranchUpdate; method?: "PATCH" }
  | { path: "/vehicles"; body: VehicleCreate; method: "POST" }
  | { path: `/vehicles/${string}`; body: VehicleUpdate; method?: "PATCH" }
  | {
      path: `/vehicles/${string}/service-records`;
      body: ServiceRecordCreate;
      method: "POST";
    }
  | { path: "/gps-devices"; body: GpsDeviceCreate; method: "POST" }
  | { path: `/gps-devices/${string}`; body: GpsDeviceUpdate; method?: "PATCH" }
  | {
      path: `/vehicles/${string}/device-assignments`;
      body: DeviceAssignmentCreate;
      method: "POST";
    }
  | {
      path: `/vehicles/${string}/device-assignments/${string}/end`;
      body?: never;
      method: "POST";
    };
export function useMutation(businessId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function mutateResult<T>({
    path,
    body,
    method = "PATCH",
  }: Mutation): Promise<T | null> {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const {
        data: { session },
      } = await browserClient().auth.getSession();
      if (!session) {
        router.replace("/login");
        return null;
      }
      const response = await fetch(`${publicEnv().api}/api/v1${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Business-Id": businessId,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 401) {
        router.replace("/login");
        return null;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages: Record<string, string> = {
          PORTAL_EMAIL_IN_USE:
            "Email này đã có tài khoản. Dùng email khác cho khách hàng.",
          PORTAL_EMAIL_REQUIRED:
            "Khách hàng cần email hợp lệ để cấp quyền cổng khách.",
          PORTAL_CUSTOMER_INACTIVE:
            "Kích hoạt khách hàng trước khi cấp quyền cổng khách.",
          PORTAL_IDENTITY_UNAVAILABLE:
            "Không thể cấp lại link cho tài khoản này.",
          PORTAL_CUSTOMER_CHANGED:
            "Hồ sơ khách vừa thay đổi. Tải lại trang và thử lại.",
          SERVICE_DATE_FUTURE:
            "Ngày thực hiện không được ở tương lai.",
          SERVICE_NEXT_ODOMETER_INVALID:
            "Mốc km tiếp theo chỉ áp dụng cho bảo dưỡng.",
          CONTRACT_NOT_READY:
            "Xác nhận đặt xe trước khi phát hành. Hợp đồng đã hủy không thể phát hành thêm.",
          CONTRACT_SEQUENCE_EXHAUSTED:
            "Đã hết dải số hợp đồng của doanh nghiệp. Liên hệ quản trị viên.",
          CONTRACT_SNAPSHOT_TOO_LARGE:
            "Nội dung hợp đồng quá dài. Rút gọn điều khoản hoặc ghi chú trước khi phát hành.",
          PRICING_PREVIEW_CHANGED:
            "Bảng giá đã thay đổi. Mở bản nháp và tải lại báo giá trước khi xác nhận đặt xe.",
          QUOTE_REFRESH_REQUIRED:
            "Hãy tải lại báo giá sau khi đổi xe, lịch thuê hoặc giá thỏa thuận.",
          PRICE_INPUT_CONFLICT:
            "Tiền thuê phải khớp với báo giá hoặc mức thỏa thuận đã xác nhận.",
          CONFIRMED_PRICE_IMMUTABLE:
            "Giá đã xác nhận được giữ nguyên. Gia hạn thời gian không tự tính lại giá thuê.",
          PRICING_REASON_REQUIRED:
            "Nhập lý do cho mức giá thỏa thuận hoặc điều chỉnh giá.",
          PRICING_MANUAL_AMOUNT_REQUIRED:
            "Chưa có báo giá phù hợp. Nhập số tiền thỏa thuận và lý do.",
          BUSINESS_HAS_PRICING_HISTORY:
            "Không thể đổi tiền tệ khi doanh nghiệp đã có bảng giá hoặc hợp đồng báo giá VND.",
          PRICING_CURRENCY_UNSUPPORTED:
            "Báo giá chỉ hỗ trợ doanh nghiệp dùng VND.",
          EVIDENCE_INVALID_UPLOAD:
            "Có file chứng cứ chưa sẵn sàng hoặc đã hết hạn. Bỏ file đó và chọn lại trước khi xác nhận biên bản.",
          EVIDENCE_UPLOAD_EXPIRED:
            "Phiên chứng cứ đã hết hạn. Bỏ file đó và chọn lại trước khi xác nhận biên bản.",
          EVIDENCE_QUOTA_EXCEEDED:
            "Chứng cứ vượt giới hạn đã cấu hình của biên bản. Hãy bỏ bớt file rồi thử lại.",
          COMMERCIAL_MOVEMENT_NOT_FOUND:
            "Không tìm thấy giao dịch trong doanh nghiệp hiện tại.",
          COMMERCIAL_ALREADY_REVERSED:
            "Giao dịch đã được đảo. Vui lòng tải lại dữ liệu.",
          COMMERCIAL_REVERSAL_NOT_ALLOWED: "Không thể đảo một bút toán đảo.",
          INSUFFICIENT_DEPOSIT_BALANCE:
            "Số dư cọc không đủ tại thời điểm giao dịch hoặc trong lịch sử sau đó. Kiểm tra lại khoản nhận, hoàn và giữ cọc.",
          COMMERCIAL_RENTAL_REQUIRED:
            "Chọn hợp đồng trong doanh nghiệp hiện tại.",
          COMMERCIAL_SCOPE_MISMATCH: "Xe không khớp với hợp đồng đã chọn.",
          INVALID_COMMERCIAL_DATE:
            "Thời điểm không được ở tương lai. Hãy kiểm tra giờ Việt Nam.",
          INVALID_COMMERCIAL_CATEGORY:
            "Danh mục không khớp với loại giao dịch.",
          COMMERCIAL_CURRENCY_UNSUPPORTED:
            "Giao dịch thương mại hiện hỗ trợ doanh nghiệp dùng VND.",
          BUSINESS_HAS_COMMERCIAL_HISTORY:
            "Doanh nghiệp đã có lịch sử giao dịch. Không thể đổi đơn vị tiền tệ để bảo toàn ý nghĩa các khoản đã ghi nhận.",
          RENTAL_HAS_COMMERCIAL_HISTORY:
            "Hợp đồng đã có giao dịch. Không thể thay xe để giữ nguyên lịch sử tài chính.",
          CUSTOMER_NOT_FOUND:
            "Khách hàng không tồn tại trong doanh nghiệp hiện tại.",
          CUSTOMER_CONTACT_REQUIRED:
            "Nhập ít nhất số điện thoại hoặc email của khách hàng.",
          CUSTOMER_INACTIVE:
            "Khách hàng đã ngưng hoạt động. Hãy chọn khách hàng khác.",
          RENTAL_NOT_FOUND:
            "Hợp đồng không tồn tại trong doanh nghiệp hiện tại.",
          RENTAL_CONFLICT:
            "Xe đã có lịch đặt hoặc đang thuê trong khoảng thời gian này. Chọn thời gian/xe khác hoặc tải lại danh sách xe sẵn sàng.",
          VEHICLE_RENTED:
            "Xe chưa được trả từ hợp đồng đang thuê. Nhận trả trước khi bàn giao hợp đồng khác.",
          RESOURCE_HAS_RENTAL:
            "Có hợp đồng đã đặt hoặc đang thuê. Hãy xử lý hợp đồng trước khi ngưng hoạt động.",
          INVALID_RENTAL_STATE:
            "Trạng thái hợp đồng đã thay đổi hoặc thao tác không còn hợp lệ. Hãy tải lại dữ liệu.",
          RENTAL_FIELDS_LOCKED:
            "Xe, khách hàng và thời gian không thể thay đổi ở trạng thái này. Dùng thao tác gia hạn khi cần.",
          RENTAL_EXPIRED:
            "Thời gian đặt xe đã hết. Cập nhật bản nháp hoặc tạo hợp đồng mới.",
          RENTAL_NOT_STARTED:
            "Chưa tới thời gian nhận xe. Bàn giao trong thời gian đã đặt.",
          INVALID_EXTENSION:
            "Thời gian trả mới phải sau thời gian trả hiện tại.",
          INVALID_ODOMETER: "Odometer trả phải bằng hoặc lớn hơn lúc bàn giao.",
          INVALID_INSPECTION:
            "Biên bản kiểm tra chưa hợp lệ. Kiểm tra mức nhiên liệu, tình trạng xe, checklist và mô tả hư hỏng rồi thử lại.",
          LAST_OWNER: "Doanh nghiệp phải có ít nhất một Owner hoạt động.",
          VEHICLE_NOT_FOUND: "Xe không tồn tại trong doanh nghiệp hiện tại.",
          DEVICE_NOT_FOUND:
            "Thiết bị không tồn tại trong doanh nghiệp hiện tại.",
          INVALID_BRANCH:
            "Chi nhánh không hợp lệ hoặc không thuộc doanh nghiệp hiện tại.",
          PLATE_EXISTS:
            "Biển số đã tồn tại trong doanh nghiệp. Hãy kiểm tra lại.",
          DEVICE_UID_EXISTS:
            "Thiết bị với nhà cung cấp và UID này đã được đăng ký.",
          VEHICLE_INACTIVE:
            "Xe đang ngưng hoạt động. Hãy kích hoạt xe trước khi đặt thuê hoặc gắn thiết bị.",
          DEVICE_INACTIVE:
            "Thiết bị đang ngưng hoạt động. Hãy kích hoạt thiết bị trước khi gắn.",
          VEHICLE_ASSIGNED:
            "Xe đã gắn thiết bị. Hãy tháo thiết bị hiện tại trước.",
          DEVICE_ASSIGNED:
            "Thiết bị đã được gắn vào xe khác. Hãy chọn thiết bị khác hoặc tháo gán trước.",
          ASSIGNMENT_NOT_FOUND: "Không tìm thấy lần gắn thiết bị này.",
          ASSIGNMENT_ENDED:
            "Lần gắn thiết bị này đã kết thúc. Hãy tải lại dữ liệu.",
          RESOURCE_HAS_ASSIGNMENT:
            "Hãy tháo thiết bị đang gắn trước khi ngưng hoạt động.",
          ROLE_CHANGE_DENIED:
            "Chỉ Owner đang hoạt động được quản lý quyền truy cập doanh nghiệp.",
          USER_NOT_FOUND:
            "Không tìm thấy tài khoản Auth. Hãy kiểm tra User ID đã được tạo.",
          MEMBERSHIP_EXISTS:
            "Owner đã có quyền truy cập. Hãy cập nhật trạng thái hiện tại.",
        };
        setError(
          messages[payload.code] ??
            (response.status === 403
              ? "Bạn không có quyền thực hiện thao tác này."
              : response.status === 400
                ? `Dữ liệu chưa hợp lệ. Kiểm tra các trường và thử lại. Mã yêu cầu: ${payload.requestId ?? "—"}`
                : `Không thể lưu (${payload.code ?? response.status}). Mã yêu cầu: ${payload.requestId ?? "—"}`),
        );
        return null;
      }
      setMessage("Đã lưu thay đổi.");
      router.refresh();
      return payload as T;
    } catch {
      setError("Không thể kết nối API. Vui lòng thử lại.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    message,
    mutate: async (input: Mutation) =>
      (await mutateResult<unknown>(input)) !== null,
    mutateResult,
    clear: () => {
      setError("");
      setMessage("");
    },
  };
}
