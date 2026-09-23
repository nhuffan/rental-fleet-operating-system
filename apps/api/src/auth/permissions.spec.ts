import { permissionsFor, canManageRole } from './permissions.js';
describe('Permission boundaries', () => {
  it('denies unknown roles and operations administration', () => {
    expect(permissionsFor('unknown')).toEqual([]);
    expect(permissionsFor('OPERATIONS')).not.toContain('user.manage');
    expect(permissionsFor('OPERATIONS')).toContain('branch.read');
  });
  it('only owners manage elevated roles', () => {
    expect(canManageRole('OWNER', 'OWNER', 'ADMIN')).toBe(true);
    expect(canManageRole('ADMIN', 'OWNER', 'OPERATIONS')).toBe(false);
    expect(canManageRole('ADMIN', 'OPERATIONS', 'OWNER')).toBe(false);
    expect(canManageRole('ADMIN', 'OPERATIONS', 'OPERATIONS')).toBe(true);
  });
});
