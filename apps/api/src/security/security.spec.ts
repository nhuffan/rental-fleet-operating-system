import 'reflect-metadata';
import { AppController } from '../app.controller.js';
import { loadConfig } from '../config.js';
import type { Database } from '../database/database.js';
import { securityHeaders } from './headers.js';
import {
  FixedWindowLimiter,
  clientKey,
  rateLimitMiddleware,
} from './rate-limit.js';

describe('FixedWindowLimiter', () => {
  it('allows the limit, then blocks until the window resets', () => {
    let now = 1_000;
    const limiter = new FixedWindowLimiter(3, 60_000, 100, () => now);
    for (let i = 0; i < 3; i++) expect(limiter.hit('a').allowed).toBe(true);
    const blocked = limiter.hit('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(limiter.hit('b').allowed).toBe(true);
    now += 60_000;
    expect(limiter.hit('a').allowed).toBe(true);
  });
  it('bounds memory by sharing one overflow bucket for excess keys', () => {
    const limiter = new FixedWindowLimiter(2, 60_000, 2, () => 0);
    limiter.hit('a');
    limiter.hit('b');
    expect(limiter.hit('c').allowed).toBe(true);
    expect(limiter.hit('d').allowed).toBe(true);
    expect(limiter.hit('e').allowed).toBe(false);
  });
});

describe('client identification', () => {
  const request = (forwarded?: string) =>
    ({
      headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
      ip: '10.0.0.9',
      socket: {},
    }) as never;
  it('ignores X-Forwarded-For unless a proxy is trusted, then uses its appended hop', () => {
    expect(clientKey(request('1.1.1.1, 2.2.2.2'), false)).toBe('10.0.0.9');
    expect(clientKey(request('spoofed, 2.2.2.2'), true)).toBe('2.2.2.2');
    expect(clientKey(request(), true)).toBe('10.0.0.9');
  });
});

describe('rateLimitMiddleware', () => {
  const run = (middleware: ReturnType<typeof rateLimitMiddleware>, path: string, method = 'GET') => {
    const next = vi.fn();
    middleware(
      { path, method, headers: {}, ip: '9.9.9.9', socket: {} } as never,
      {} as never,
      next,
    );
    return next.mock.calls[0]?.[0] as
      | { getStatus(): number; getResponse(): { code: string; retryAfter: number } }
      | undefined;
  };
  it('returns 429 RATE_LIMITED with Retry-After data and exempts health, webhook and preflight', () => {
    const middleware = rateLimitMiddleware({ perMinute: 2, trustProxy: false });
    expect(run(middleware, '/api/v1/vehicles')).toBeUndefined();
    expect(run(middleware, '/api/v1/vehicles')).toBeUndefined();
    const error = run(middleware, '/api/v1/vehicles');
    expect(error?.getStatus()).toBe(429);
    expect(error?.getResponse()).toMatchObject({ code: 'RATE_LIMITED' });
    expect(run(middleware, '/api/v1/health/ready')).toBeUndefined();
    expect(run(middleware, '/api/v1/integrations/traccar/positions')).toBeUndefined();
    expect(run(middleware, '/api/v1/vehicles', 'OPTIONS')).toBeUndefined();
  });
});

describe('security headers', () => {
  it('denies framing/referrers and adds HSTS only outside development', () => {
    const dev = securityHeaders('development');
    expect(dev).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    });
    expect(dev['Strict-Transport-Security']).toBeUndefined();
    expect(securityHeaders('production')['Strict-Transport-Security']).toContain(
      'max-age=31536000',
    );
  });
});

describe('readiness', () => {
  it('is ready when the database answers and hides failure details', async () => {
    const ok = new AppController({
      pool: { query: async () => ({ rows: [] }) },
    } as unknown as Database);
    await expect(ok.ready()).resolves.toMatchObject({ status: 'ready' });
    const down = new AppController({
      pool: {
        query: async () => {
          throw new Error('password authentication failed for user secret-user');
        },
      },
    } as unknown as Database);
    const error = await down.ready().catch((e: unknown) => e);
    expect(JSON.stringify((error as { getResponse(): unknown }).getResponse())).not.toContain(
      'secret-user',
    );
    expect((error as { getStatus(): number }).getStatus()).toBe(503);
    expect(new AppController(ok as never).health()).toMatchObject({ status: 'ok' });
  });
});

describe('production configuration guard', () => {
  const keys = [
    'APP_ENV',
    'WEB_ORIGIN',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'DATABASE_URL',
    'ALLOW_DEMO_SEED',
    'RATE_LIMIT_PER_MINUTE',
    'TRUST_PROXY',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of keys)
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
  });
  const production = () => {
    Object.assign(process.env, {
      APP_ENV: 'production',
      WEB_ORIGIN: 'https://app.example.com',
      SUPABASE_URL: 'https://abcdefghij.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable',
      SUPABASE_SECRET_KEY: 'secret',
      DATABASE_URL: 'postgresql://postgres.abcdefghij:pw@aws-0.pooler.supabase.com:5432/postgres',
    });
    // Explicit values: loadConfig also reads a local .env that must not leak into the test.
    process.env.ALLOW_DEMO_SEED = 'false';
    process.env.RATE_LIMIT_PER_MINUTE = '300';
    process.env.TRUST_PROXY = 'false';
  };
  it('accepts a complete production configuration with safe defaults', () => {
    production();
    expect(loadConfig()).toMatchObject({
      rateLimitPerMinute: 300,
      trustProxy: false,
    });
  });
  it('rejects demo seeding, a missing server key and invalid limits', () => {
    production();
    process.env.ALLOW_DEMO_SEED = 'true';
    expect(() => loadConfig()).toThrow(/ALLOW_DEMO_SEED/);
    production();
    process.env.SUPABASE_SECRET_KEY = '';
    expect(() => loadConfig()).toThrow(/SUPABASE_SECRET_KEY/);
    production();
    process.env.RATE_LIMIT_PER_MINUTE = '1';
    expect(() => loadConfig()).toThrow(/RATE_LIMIT/);
  });
});
