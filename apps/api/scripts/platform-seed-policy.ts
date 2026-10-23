export const DEVELOPMENT_PLATFORM_PROJECT = 'eeryymswcufnebibigqf';
export class PlatformSeedRefused extends Error {}
export type DemoAccount = {
  id: string;
  email: string;
  password: string;
  role: string;
  business: string;
  status: string;
};
export type PlatformDemo = {
  projectRef: string;
  accounts: Record<string, DemoAccount>;
  retired?: boolean;
  [key: string]: unknown;
};
export function assertPlatformSeedEnvironment(
  environment: string,
  supabaseUrl: string,
  allowDemoSeed: string | undefined,
  selectedProject?: string,
) {
  const url = new URL(supabaseUrl);
  if (
    environment !== 'development' ||
    allowDemoSeed !== 'true' ||
    url.protocol !== 'https:' ||
    url.hostname !== `${DEVELOPMENT_PLATFORM_PROJECT}.supabase.co` ||
    (selectedProject !== undefined &&
      selectedProject !== DEVELOPMENT_PLATFORM_PROJECT)
  )
    throw new PlatformSeedRefused(
      'Platform demo bootstrap requires the exact development project and ALLOW_DEMO_SEED=true',
    );
}
export function platformDemo(value: unknown): PlatformDemo {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new PlatformSeedRefused(
      'An existing development demo fixture is required',
    );
  const data = value as Partial<PlatformDemo>;
  if (data.retired === true)
    throw new PlatformSeedRefused(
      'Persistent demo seeding is retired; use disposable E2E fixtures instead.',
    );
  if (
    data.projectRef !== DEVELOPMENT_PLATFORM_PROJECT ||
    typeof data.accounts !== 'object' ||
    data.accounts === null ||
    Array.isArray(data.accounts)
  )
    throw new PlatformSeedRefused(
      'Demo fixture must belong to the exact development project',
    );
  return data as PlatformDemo;
}
export function existingPlatformOperator(data: PlatformDemo) {
  const account = data.accounts.platformOperator;
  if (account === undefined) return undefined;
  if (
    !account ||
    typeof account !== 'object' ||
    typeof account.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      account.id,
    ) ||
    typeof account.email !== 'string' ||
    !account.email.includes('@') ||
    typeof account.password !== 'string' ||
    account.password.length < 12 ||
    account.role !== 'PLATFORM_OPERATOR' ||
    account.business !== '' ||
    !['ACTIVE', 'DISABLED'].includes(account.status)
  )
    throw new PlatformSeedRefused(
      'Existing platformOperator must be a dedicated platform identity',
    );
  if (
    Object.entries(data.accounts).some(
      ([name, candidate]) =>
        name !== 'platformOperator' &&
        typeof candidate?.id === 'string' &&
        candidate.id.toLowerCase() === account.id.toLowerCase(),
    )
  )
    throw new PlatformSeedRefused(
      'A tenant or other demo account cannot be reused as the platform operator',
    );
  return account;
}
