export const ROLES = ['OWNER'] as const;
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
  'vehicle.read',
  'vehicle.manage',
  'gps.read',
  'gps.manage',
  'customer.read',
  'customer.manage',
  'rental.read',
  'rental.manage',
  'trip.read',
  'commercial.read',
  'commercial.manage',
  'alert.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
// Supabase supplies identity only. Customer access is deferred and legacy tenant
// roles never receive a fallback grant, including when a stale session survives.
export function permissionsFor(role: string): readonly Permission[] {
  return role === 'OWNER' ? PERMISSIONS : [];
}
