export const ROLES = ['OWNER', 'ADMIN', 'OPERATIONS'] as const;
export type Role = (typeof ROLES)[number];
export const PERMISSIONS = [
  'business.read',
  'business.update',
  'user.read',
  'user.manage',
  'branch.read',
  'branch.manage',
  'settings.read',
  'settings.update',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
const map: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: PERMISSIONS,
  OPERATIONS: ['business.read', 'branch.read', 'settings.read'],
};
export function permissionsFor(role: string): readonly Permission[] {
  return map[role as Role] ?? [];
}
export function canManageRole(
  actor: string,
  before: string | undefined,
  after: string,
) {
  return (
    actor === 'OWNER' ||
    (actor === 'ADMIN' &&
      (!before || before === 'OPERATIONS') &&
      after === 'OPERATIONS')
  );
}
