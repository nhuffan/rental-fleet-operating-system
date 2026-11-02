export type PlatformWritePermission =
  | "platform.business.create"
  | "platform.business.manage"
  | "platform.owner.access";

// Presentation only; NestJS checks the independent platform grant on every request.
export function canPlatformAction(
  permissions: readonly string[],
  action: PlatformWritePermission,
) {
  return permissions.includes(action);
}
export function canIssueOwnerLink(
  businessStatus: string,
  owner: { status: string; profileStatus: string },
) {
  return (
    businessStatus === "ACTIVE" &&
    owner.status === "ACTIVE" &&
    owner.profileStatus === "ACTIVE"
  );
}
export function ownerAccessUnavailable(
  businessStatus: string,
  owner: { status: string; profileStatus: string },
) {
  if (businessStatus !== "ACTIVE")
    return "Kích hoạt doanh nghiệp trước khi cấp link.";
  if (owner.status !== "ACTIVE")
    return "Quyền truy cập Owner đang bị vô hiệu hóa.";
  if (owner.profileStatus !== "ACTIVE")
    return "Hồ sơ Owner đang bị vô hiệu hóa.";
  return "";
}
