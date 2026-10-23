import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loadConfig } from './config.js';
import { GpsIngress } from './telematics/gps/ingress.js';
@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host
      .switchToHttp()
      .getRequest<Request & { requestId: string }>();
    const res = host.switchToHttp().getResponse<Response>();
    const statusCode = error instanceof HttpException ? error.getStatus() : 500;
    const details = error instanceof HttpException ? error.getResponse() : {};
    const data =
      typeof details === 'object' && details !== null
        ? (details as {
            code?: string;
            message?: string | string[];
            retryAfter?: number;
          })
        : {};
    const message =
      statusCode >= 500
        ? 'Internal server error'
        : (data.message ??
          (typeof details === 'string' ? details : 'Request failed'));
    if (statusCode >= 500)
      console.error(
        JSON.stringify({
          requestId: req.requestId,
          statusCode,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
    if (statusCode === 429 && Number.isInteger(data.retryAfter))
      res.setHeader('Retry-After', Math.max(1, Math.min(60, data.retryAfter!)));
    // Never serialize database errors, request bodies, tokens or credentials.
    res.status(statusCode).json({
      statusCode,
      code:
        data.code ??
        {
          400: 'VALIDATION_ERROR',
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
          413: 'PAYLOAD_TOO_LARGE',
          415: 'UNSUPPORTED_MEDIA_TYPE',
          429: 'RATE_LIMITED',
        }[statusCode] ??
        'INTERNAL_ERROR',
      message: Array.isArray(message) ? message.join('; ') : message,
      requestId: req.requestId,
    });
  }
}
export function configureApp(app: INestApplication) {
  const config = loadConfig();
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.origin,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Business-Id',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });
  app.use(
    (
      req: Request & { requestId: string },
      res: Response,
      next: NextFunction,
    ) => {
      req.requestId = randomUUID();
      res.setHeader('X-Request-Id', req.requestId);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const start = performance.now();
      res.on('finish', () => {
        if (process.env.LOG_REQUESTS !== 'false')
          console.log(
            JSON.stringify({
              requestId: req.requestId,
              method: req.method,
              path: req.path,
              status: res.statusCode,
              durationMs: Math.round(performance.now() - start),
            }),
          );
      });
      next();
    },
  );
  // Installed before Nest's default JSON parser; other routes retain their defaults.
  app.use(
    '/api/v1/integrations/traccar/positions',
    app.get(GpsIngress).middleware(),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );
  app.useGlobalFilters(new Errors());
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Rental Fleet API')
      .setDescription(
        'Tenant-scoped SaaS Core, Fleet Core and Customer/Rental Core. Bearer token required; optional X-Business-Id selects an active membership. Lists use page/limit; errors include statusCode, code, message and requestId.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build(),
  );
  for (const [path, item] of Object.entries(document.paths))
    for (const verb of ['get', 'post', 'patch'] as const) {
      const operation = item?.[verb];
      if (!operation) continue;
      const statuses = ['400', '401', '403', '404', '409', '500'];
      if (verb === 'post' && path === '/api/v1/integrations/traccar/positions')
        statuses.push('413', '415', '429');
      for (const status of statuses)
        operation.responses[status] = {
          description: 'Standard API error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['statusCode', 'code', 'message', 'requestId'],
                properties: {
                  statusCode: { type: 'integer' },
                  code: { type: 'string' },
                  message: { type: 'string' },
                  requestId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        };
    }
  if (config.environment !== 'production')
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/openapi.json',
    });
  return document;
}
