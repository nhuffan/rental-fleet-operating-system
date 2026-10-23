export const PLATFORM_ROLE = 'PLATFORM_OPERATOR' as const;
export const PLATFORM_PERMISSIONS = [
  'platform.overview.read',
  'platform.business.read',
  'platform.audit.read',
  'platform.user.read',
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
export function platformPermissionsFor(
  role: string,
): readonly PlatformPermission[] {
  return role === PLATFORM_ROLE ? PLATFORM_PERMISSIONS : [];
}
