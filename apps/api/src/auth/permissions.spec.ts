import { permissionsFor, canManageRole } from './permissions.js';
describe('Permission boundaries', () => {
  it('denies unknown roles and operations administration', () => {
    expect(permissionsFor('unknown')).toEqual([]);
    expect(permissionsFor('OPERATIONS')).not.toContain('user.manage');
    expect(permissionsFor('OPERATIONS')).toContain('branch.read');
    for (const permission of [
      'vehicle.read',
      'gps.read',
      'customer.read',
      'rental.read',
      'trip.read',
    ])
      expect(permissionsFor('OPERATIONS')).toContain(permission);
    for (const permission of [
      'vehicle.manage',
      'gps.manage',
      'customer.manage',
      'rental.manage',
    ]) {
      expect(permissionsFor('OPERATIONS')).not.toContain(permission);
      expect(permissionsFor('ADMIN')).toContain(permission);
      expect(permissionsFor('OWNER')).toContain(permission);
    }
  });
  it('only owners manage elevated roles', () => {
    expect(canManageRole('OWNER', 'OWNER', 'ADMIN')).toBe(true);
    expect(canManageRole('ADMIN', 'OWNER', 'OPERATIONS')).toBe(false);
    expect(canManageRole('ADMIN', 'OPERATIONS', 'OWNER')).toBe(false);
    expect(canManageRole('ADMIN', 'OPERATIONS', 'OPERATIONS')).toBe(true);
  });
});
