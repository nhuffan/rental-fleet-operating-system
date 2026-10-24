import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthGuard, PermissionGuard, TenantGuard } from '../auth/guards.js';
import { AlertsController } from './alerts.controller.js';
import { AlertQuery } from './dto.js';
const options = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};
it('accepts bounded page/filter input and applies standard pagination defaults', async () => {
  const q = plainToInstance(AlertQuery, {
    page: '2',
    limit: '100',
    kind: 'GPS_STALE',
    severity: 'CRITICAL',
    vehicleId: 'bd3ee2b9-1b0f-45d3-9c5d-79956e496c51',
  });
  expect(await validate(q, options)).toEqual([]);
  expect(q).toMatchObject({ page: 2, limit: 100 });
  expect(new AlertQuery()).toMatchObject({ page: 1, limit: 20 });
});
it('rejects unbounded, unknown, malformed and tenant/write inputs', async () => {
  for (const extra of [
    { limit: 101 },
    { limit: 0 },
    { page: 0 },
    { page: 1.5 },
    { page: 1000001 },
    { kind: 'NO_DATA' },
    { severity: 'INFO' },
    { rentalId: 'invalid' },
    { vehicleId: null },
    { businessId: 'forged' },
    { acknowledged: true },
    { asOf: '2020-01-01T00:00:00Z' },
  ])
    expect(
      (await validate(plainToInstance(AlertQuery, extra), options)).length,
    ).toBeGreaterThan(0);
});
it('requires verified identity, tenant principal and alert.read on the only read endpoint', () => {
  expect(Reflect.getMetadata('__guards__', AlertsController)).toEqual([
    AuthGuard,
    TenantGuard,
    PermissionGuard,
  ]);
  expect(
    Reflect.getMetadata(
      'permission',
      Object.getOwnPropertyDescriptor(AlertsController.prototype, 'list')
        ?.value as object,
    ),
  ).toBe('alert.read');
});
