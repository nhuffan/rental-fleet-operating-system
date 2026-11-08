import { HttpException, HttpStatus } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Process-local fixed-window limiter. It bounds abuse of a single instance and does not
 * replace gateway limits (see the launch checklist): counts are not shared across instances. */
export class FixedWindowLimiter {
  private counts = new Map<string, number>();
  private windowStart: number;
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
    private readonly now: () => number = Date.now,
  ) {
    this.windowStart = now();
  }
  hit(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const current = this.now();
    if (current - this.windowStart >= this.windowMs) {
      this.counts.clear();
      this.windowStart = current;
    }
    // New keys beyond the cap share one overflow bucket so memory stays bounded.
    const bucket =
      this.counts.has(key) || this.counts.size < this.maxKeys ? key : '*';
    const count = (this.counts.get(bucket) ?? 0) + 1;
    this.counts.set(bucket, count);
    return {
      allowed: count <= this.limit,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((this.windowStart + this.windowMs - current) / 1000),
      ),
    };
  }
}

/** X-Forwarded-For is attacker-controlled unless a trusted proxy sets it, so it is only
 * read when TRUST_PROXY=true (the last hop appended by that proxy is the client). */
export function clientKey(
  req: Pick<Request, 'headers' | 'ip' | 'socket'>,
  trustProxy: boolean,
): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded.at(-1) : forwarded;
    const last = value?.split(',').at(-1)?.trim();
    if (last) return last.slice(0, 64);
  }
  return (req.ip ?? req.socket?.remoteAddress ?? 'unknown').slice(0, 64);
}

const EXEMPT = [
  '/api/v1/health',
  // Authenticated device webhook has its own bounded ingress limits.
  '/api/v1/integrations/traccar/positions',
];

export function rateLimitMiddleware(options: {
  perMinute: number;
  trustProxy: boolean;
  limiter?: FixedWindowLimiter;
}) {
  const limiter =
    options.limiter ?? new FixedWindowLimiter(options.perMinute, 60_000);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' || EXEMPT.some((p) => req.path.startsWith(p)))
      return next();
    const result = limiter.hit(clientKey(req, options.trustProxy));
    if (result.allowed) return next();
    next(
      new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          retryAfter: result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  };
}
