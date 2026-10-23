import { PERMISSIONS, permissionsFor, ROLES } from './permissions.js';
describe('Permission boundaries', () => {
  it('grants the complete tenant workspace to Owner only', () => {
    expect(ROLES).toEqual(['OWNER']);
    expect(permissionsFor('OWNER')).toEqual(PERMISSIONS);
  });
  it.each([
    'ADMIN',
    'OPERATIONS',
    'CUSTOMER',
    'PLATFORM_OPERATOR',
    'unknown',
    'constructor',
    '__proto__',
  ])('denies all tenant permissions for %s', (role) =>
    expect(permissionsFor(role)).toEqual([]),
  );
});
