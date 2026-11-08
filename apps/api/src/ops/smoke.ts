// Post-deploy smoke checks. They send no credentials and change no data: every request is
// an unauthenticated GET, so they are safe against staging or production.
export type SmokeOptions = {
  api: string;
  web: string;
  production: boolean;
  fetch?: typeof fetch;
};
export type SmokeCheck = { name: string; ok: boolean; detail: string };

const baseUrl = (value: string) => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Use http(s) URLs');
  return url.origin;
};

export async function runSmoke(options: SmokeOptions): Promise<SmokeCheck[]> {
  const api = baseUrl(options.api);
  const web = baseUrl(options.web);
  const doFetch = options.fetch ?? fetch;
  const checks: SmokeCheck[] = [];
  const get = async (url: string) => {
    try {
      return await doFetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return null;
    }
  };
  const check = (name: string, ok: boolean, detail: string) =>
    checks.push({ name, ok, detail });

  const health = await get(`${api}/api/v1/health`);
  check('api liveness', health?.status === 200, `status ${health?.status ?? 'unreachable'}`);
  const ready = await get(`${api}/api/v1/health/ready`);
  check('api readiness (database)', ready?.status === 200, `status ${ready?.status ?? 'unreachable'}`);
  if (health) {
    const h = health.headers;
    check('api security headers', h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY' && h.get('referrer-policy') === 'no-referrer', 'nosniff, frame deny, no-referrer');
    if (api.startsWith('https://'))
      check('api HSTS', (h.get('strict-transport-security') ?? '').includes('max-age='), 'Strict-Transport-Security present');
    check('api request id', Boolean(h.get('x-request-id')), 'X-Request-Id present');
  }
  for (const path of ['/api/v1/me', '/api/v1/platform/me', '/api/v1/portal/me']) {
    const r = await get(`${api}${path}`);
    check(`unauthenticated ${path} is rejected`, r?.status === 401, `status ${r?.status ?? 'unreachable'}`);
  }
  const webhook = await get(`${api}/api/v1/integrations/traccar/positions`);
  check('gps webhook rejects unauthenticated GET', webhook !== null && webhook.status >= 400 && webhook.status < 500, `status ${webhook?.status ?? 'unreachable'}`);
  const docs = await get(`${api}/api/docs`);
  if (options.production)
    check('swagger is disabled in production', docs?.status === 404, `status ${docs?.status ?? 'unreachable'}`);

  const login = await get(`${web}/login`);
  check('web login page', login?.status === 200, `status ${login?.status ?? 'unreachable'}`);
  if (login)
    check('web frame protection', login.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options DENY');
  for (const [path, prefix] of [['/app', '/login'], ['/superadmin', '/login'], ['/portal', '/login']] as const) {
    const r = await get(`${web}${path}`);
    const location = r?.headers.get('location') ?? '';
    check(`unauthenticated ${path} redirects to login`, Boolean(r) && r!.status >= 300 && r!.status < 400 && location.includes(prefix), `status ${r?.status ?? 'unreachable'}`);
  }
  if (options.production) {
    const preview = await get(`${web}/dev-preview/business`);
    check('development previews are not served', preview?.status === 404, `status ${preview?.status ?? 'unreachable'}`);
  }
  return checks;
}

export function smokeOptions(args: string[]): SmokeOptions {
  const value = (name: string) =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const unknown = args.filter(
    (a) => !/^--(api|web)=.+$/.test(a) && a !== '--production',
  );
  const api = value('api'),
    web = value('web');
  if (unknown.length || !api || !web)
    throw new Error('Use --api=<url> --web=<url> [--production]');
  return { api, web, production: args.includes('--production') };
}
