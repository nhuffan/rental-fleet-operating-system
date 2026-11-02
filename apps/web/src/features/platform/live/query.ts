import { pageNumber, text, validId, type SearchParams } from "@/lib/query";
export function businessFilters(params: SearchParams) {
  const status = text(params.status);
  return {
    page: pageNumber(params.page),
    limit: [20, 50, 100].includes(Number(params.limit))
      ? Number(params.limit)
      : 20,
    search: text(params.search, 120),
    status: ["ACTIVE", "DISABLED"].includes(status) ? status : "",
    sort: text(params.sort) === "name" ? "name" : "createdAt",
    order: text(params.order) === "asc" ? "asc" : "desc",
  };
}
export type BusinessFilters = ReturnType<typeof businessFilters>;

export const auditLabels: Record<string, string> = {
  "platform.me.read": "Xem quyền platform",
  "platform.overview.read": "Xem tổng quan",
  "platform.businesses.read": "Xem danh sách doanh nghiệp",
  "platform.business.read": "Xem doanh nghiệp",
  "platform.business.create": "Tạo doanh nghiệp và Owner",
  "platform.owner.access_link.issue": "Cấp link đăng nhập Owner",
  "platform.business.status.update": "Đổi trạng thái doanh nghiệp",
  "platform.audit.read": "Xem nhật ký nền tảng",
  "platform.users.read": "Tra cứu người dùng",
  "platform.user.read": "Xem hồ sơ hỗ trợ",
  "platform_membership.create": "Cấp quyền platform (quản trị viên)",
  other: "Sự kiện khác (đã lược bỏ chi tiết)",
};
export function auditFilters(params: SearchParams) {
  const date = (key: string) => {
    const value = text(params[key], 40);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) && Number.isFinite(Date.parse(value))
      ? new Date(value).toISOString()
      : "";
  };
  return {
    page: pageNumber(params.page),
    limit: businessFilters(params).limit,
    action: Object.hasOwn(auditLabels, text(params.action))
      ? text(params.action)
      : "",
    businessId: validId(text(params.businessId)) ? text(params.businessId) : "",
    from: date("from"),
    until: date("until"),
    sort: text(params.sort) === "action" ? "action" : "createdAt",
    order: text(params.order) === "asc" ? "asc" : "desc",
  };
}
export function userFilters(params: SearchParams) {
  return {
    ...businessFilters(params),
    businessId: validId(text(params.businessId)) ? text(params.businessId) : "",
    membershipStatus: ["ACTIVE", "DISABLED"].includes(
      text(params.membershipStatus),
    )
      ? text(params.membershipStatus)
      : "",
  };
}
