import { randomUUID } from 'node:crypto';
import {
  assertPlatformSeedEnvironment,
  DEVELOPMENT_PLATFORM_PROJECT,
  existingPlatformOperator,
  platformDemo,
  PlatformSeedRefused,
  type PlatformDemo,
} from '../../scripts/platform-seed-policy.js';
const projectUrl = `https://${DEVELOPMENT_PLATFORM_PROJECT}.supabase.co`;
const fixture = (): PlatformDemo => ({
  projectRef: DEVELOPMENT_PLATFORM_PROJECT,
  accounts: {
    platformOperator: {
      id: randomUUID(),
      email: 'platform@example.test',
      password: 'long-random-demo-password',
      role: 'PLATFORM_OPERATOR',
      business: '',
      status: 'ACTIVE',
    },
  },
});
it('requires explicit seeding permission, HTTPS and the exact development project', () => {
  expect(() =>
    assertPlatformSeedEnvironment(
      'development',
      projectUrl,
      'true',
      DEVELOPMENT_PLATFORM_PROJECT,
    ),
  ).not.toThrow();
  for (const [environment, url, allow, selected] of [
    ['production', projectUrl, 'true', DEVELOPMENT_PLATFORM_PROJECT],
    ['staging', projectUrl, 'true', DEVELOPMENT_PLATFORM_PROJECT],
    ['development', projectUrl, undefined, DEVELOPMENT_PLATFORM_PROJECT],
    ['development', 'https://other.supabase.co', 'true', 'other'],
    ['development', projectUrl, 'true', 'other'],
    [
      'development',
      projectUrl.replace('https:', 'http:'),
      'true',
      DEVELOPMENT_PLATFORM_PROJECT,
    ],
  ])
    expect(() =>
      assertPlatformSeedEnvironment(environment!, url!, allow, selected),
    ).toThrow(PlatformSeedRefused);
});
it('refuses foreign/missing fixtures and tenant identities disguised as the platform operator', () => {
  for (const value of [null, {}, { projectRef: 'other', accounts: {} }])
    expect(() => platformDemo(value)).toThrow(PlatformSeedRefused);
  for (const fields of [{ role: 'OWNER' }, { business: randomUUID() }]) {
    const data = fixture();
    Object.assign(data.accounts.platformOperator, fields);
    expect(() => existingPlatformOperator(data)).toThrow(PlatformSeedRefused);
  }
  const reused = fixture();
  reused.accounts.ownerA = {
    ...reused.accounts.platformOperator,
    role: 'OWNER',
    business: randomUUID(),
  };
  expect(() => existingPlatformOperator(reused)).toThrow(PlatformSeedRefused);
});
it('supports only a dedicated identity and preserves explicitly disabled fixture state', () => {
  const data = fixture();
  data.accounts.platformOperator.status = 'DISABLED';
  expect(existingPlatformOperator(platformDemo(data))).toBe(
    data.accounts.platformOperator,
  );
  expect(data.accounts.platformOperator.status).toBe('DISABLED');
  expect(
    existingPlatformOperator({
      projectRef: DEVELOPMENT_PLATFORM_PROJECT,
      accounts: {},
    }),
  ).toBeUndefined();
});
