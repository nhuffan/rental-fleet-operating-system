import { runSmoke, smokeOptions } from './smoke.js';

const respond = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers });
const good = (url: string): Response => {
  const path = new URL(url).pathname;
  const secure = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'strict-transport-security': 'max-age=31536000',
    'x-request-id': 'abc',
  };
  if (path === '/api/v1/health' || path === '/api/v1/health/ready') return respond(200, secure);
  if (path.startsWith('/api/v1/integrations')) return respond(401);
  if (path.startsWith('/api/v1/')) return respond(401);
  if (path === '/api/docs') return respond(404);
  if (path === '/login') return respond(200, { 'x-frame-options': 'DENY' });
  if (['/app', '/superadmin', '/portal'].includes(path))
    return respond(307, { location: '/login?next=' + path });
  return respond(404);
};
const run = (fetcher: (url: string) => Response | Promise<Response>, production = true) =>
  runSmoke({
    api: 'https://api.example.com',
    web: 'https://app.example.com',
    production,
    fetch: (async (url: string) => fetcher(url)) as unknown as typeof fetch,
  });

describe('smoke checks', () => {
  it('passes a healthy production deployment', async () => {
    const checks = await run(good);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(checks.length).toBeGreaterThan(12);
  });
  it('fails readiness, missing headers, exposed docs/previews and open private routes', async () => {
    const checks = await run((url) => {
      const path = new URL(url).pathname;
      if (path === '/api/v1/health/ready') return respond(503);
      if (path === '/api/v1/me') return respond(200);
      if (path === '/api/docs' || path === '/dev-preview/business') return respond(200);
      if (path === '/login') return respond(200);
      if (path === '/api/v1/health') return respond(200);
      return good(url);
    });
    const failed = checks.filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toEqual(
      expect.arrayContaining([
        'api readiness (database)',
        'api security headers',
        'unauthenticated /api/v1/me is rejected',
        'swagger is disabled in production',
        'web frame protection',
        'development previews are not served',
      ]),
    );
  });
  it('treats an unreachable service as failure and skips production-only checks otherwise', async () => {
    const down = await run(() => {
      throw new Error('ECONNREFUSED');
    });
    expect(down.every((c) => !c.ok)).toBe(true);
    const staging = await run(good, false);
    expect(staging.map((c) => c.name)).not.toContain('swagger is disabled in production');
  });
  it('validates arguments and sends only GET requests without credentials', async () => {
    expect(() => smokeOptions([])).toThrow();
    expect(() => smokeOptions(['--api=a', '--web=b', '--password=x'])).toThrow();
    expect(smokeOptions(['--api=https://a.test', '--web=https://b.test', '--production'])).toMatchObject({ production: true });
    const seen: RequestInit[] = [];
    await runSmoke({
      api: 'https://api.example.com',
      web: 'https://app.example.com',
      production: false,
      fetch: (async (url: string, init?: RequestInit) => {
        seen.push(init ?? {});
        return good(url);
      }) as unknown as typeof fetch,
    });
    expect(seen.every((i) => !i.method && !i.headers && !i.body)).toBe(true);
    await expect(runSmoke({ api: 'ftp://x', web: 'https://b.test', production: false })).rejects.toThrow();
  });
});
