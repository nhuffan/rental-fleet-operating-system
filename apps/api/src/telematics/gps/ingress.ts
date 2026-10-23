import { HttpException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { json, type NextFunction, type Request, type Response } from 'express';
import { authenticateTraccar } from './traccar.adapter.js';
export const GPS_INGRESS_LIMITS = Object.freeze({
  bodyBytes: 16 * 1024,
  windowSeconds: 60,
  globalRequests: 600,
  deviceRequests: 120,
  concurrentRequests: 16,
  trackedDevices: 1024,
});
export type IngressLimits = typeof GPS_INGRESS_LIMITS;
export type IngressOutcome =
  | 'accepted'
  | 'duplicate'
  | 'authenticationRejected'
  | 'disabled'
  | 'invalidPayload'
  | 'bodyRejected'
  | 'rateGlobal'
  | 'rateDevice'
  | 'resolutionRejected'
  | 'internalFailure';
const outcomes: IngressOutcome[] = [
  'accepted',
  'duplicate',
  'authenticationRejected',
  'disabled',
  'invalidPayload',
  'bodyRejected',
  'rateGlobal',
  'rateDevice',
  'resolutionRejected',
  'internalFailure',
];
const minute = GPS_INGRESS_LIMITS.windowSeconds * 1000;
/** Process-local controls, intentionally bounded even for authenticated unknown UIDs.
 * They complement a deployment gateway; they are not a distributed quota. */
@Injectable()
export class GpsIngress {
  private globalCount = 0;
  private active = 0;
  private window = -1;
  private readonly devices = new Map<string, number>();
  private readonly counters: Record<IngressOutcome, number> =
    Object.fromEntries(outcomes.map((k) => [k, 0])) as Record<
      IngressOutcome,
      number
    >;
  private readonly clock = Date.now;
  record(outcome: IngressOutcome) {
    this.rollWindow();
    this.counters[outcome] = Math.min(
      Number.MAX_SAFE_INTEGER,
      this.counters[outcome] + 1,
    );
  }
  private rollWindow() {
    const window = Math.floor(this.clock() / minute);
    if (this.window === window) return;
    if (
      this.window >= 0 &&
      Object.values(this.counters).some(Boolean) &&
      process.env.LOG_REQUESTS !== 'false'
    )
      console.log(
        JSON.stringify({
          event: 'gps_ingress_window',
          sourceMode: 'TEST',
          windowSeconds: 60,
          counts: this.counters,
        }),
      );
    this.window = window;
    this.globalCount = 0;
    this.devices.clear();
    for (const key of outcomes) this.counters[key] = 0;
  }
  retryAfter() {
    return Math.max(
      1,
      Math.ceil(((this.window + 1) * minute - this.clock()) / 1000),
    );
  }
  private limited(outcome: 'rateGlobal' | 'rateDevice') {
    this.record(outcome);
    throw new HttpException(
      {
        code: 'GPS_RATE_LIMITED',
        message:
          'GPS ingestion capacity reached; retry after the indicated delay',
        retryAfter: this.retryAfter(),
      },
      429,
    );
  }
  reserveRequest() {
    this.rollWindow();
    if (
      ++this.globalCount > GPS_INGRESS_LIMITS.globalRequests ||
      this.active >= GPS_INGRESS_LIMITS.concurrentRequests
    )
      this.limited('rateGlobal');
    this.active++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.active--;
      }
    };
  }
  consumeDevice(provider: string, deviceUid: string) {
    this.rollWindow();
    const key = createHash('sha256')
      .update(provider)
      .update('\0')
      .update(deviceUid)
      .digest('hex');
    const count = this.devices.get(key);
    if (
      (count === undefined &&
        this.devices.size >= GPS_INGRESS_LIMITS.trackedDevices) ||
      (count ?? 0) >= GPS_INGRESS_LIMITS.deviceRequests
    )
      this.limited('rateDevice');
    this.devices.set(key, (count ?? 0) + 1);
  }
  middleware() {
    const parser = json({
      limit: GPS_INGRESS_LIMITS.bodyBytes,
      inflate: false,
      strict: true,
      type: ['application/json', 'application/*+json'],
    });
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'POST') return next();
      let release: (() => void) | undefined;
      try {
        release = this.reserveRequest();
        // Authenticate before reading/parsing the body; do not trust a body UID yet.
        try {
          authenticateTraccar(req.get('x-traccar-token'));
        } catch (error) {
          this.record(
            error instanceof HttpException && error.getStatus() === 401
              ? 'authenticationRejected'
              : 'disabled',
          );
          throw error;
        }
        if (!req.is(['application/json', 'application/*+json'])) {
          this.record('bodyRejected');
          throw new HttpException(
            {
              code: 'INVALID_GPS_MEDIA_TYPE',
              message: 'GPS ingestion requires JSON',
            },
            415,
          );
        }
        if (
          req.get('content-encoding') &&
          req.get('content-encoding')?.toLowerCase() !== 'identity'
        ) {
          this.record('bodyRejected');
          throw new HttpException(
            {
              code: 'INVALID_GPS_ENCODING',
              message: 'Compressed GPS bodies are not accepted',
            },
            415,
          );
        }
        const done = release;
        res.once('finish', done);
        res.once('close', done);
        parser(req, res, (error?: unknown) => {
          if (error) {
            this.record('bodyRejected');
            const tooLarge =
              typeof error === 'object' &&
              error !== null &&
              'type' in error &&
              error.type === 'entity.too.large';
            next(
              new HttpException(
                {
                  code: tooLarge ? 'GPS_BODY_TOO_LARGE' : 'INVALID_GPS_JSON',
                  message: tooLarge
                    ? 'GPS JSON exceeds the 16 KiB limit'
                    : 'Invalid GPS JSON',
                },
                tooLarge ? 413 : 400,
              ),
            );
          } else next();
        });
      } catch (error) {
        release?.();
        next(error);
      }
    };
  }
}
