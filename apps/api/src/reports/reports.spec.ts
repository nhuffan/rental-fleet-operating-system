import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthGuard, PermissionGuard, TenantGuard } from '../auth/guards.js';
import { permissionsFor } from '../auth/permissions.js';
import { ReportExportParams, ReportQuery } from './dto.js';
import { ReportsController } from './reports.controller.js';
import { reportWindow } from './reports.service.js';

const options = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};
const now = new Date('2026-11-08T08:00:00Z');

describe('report query validation', () => {
  it('accepts offset-qualified windows and rejects unknown/forged input', async () => {
    expect(
      await validate(
        plainToInstance(ReportQuery, {
          from: '2026-10-01T00:00:00+07:00',
          until: '2026-11-01T00:00:00Z',
        }),
        options,
      ),
    ).toEqual([]);
    for (const extra of [
      { from: '2026-10-01' },
      { from: '2026-10-01T00:00:00' },
      { businessId: 'forged' },
      { limit: 5 },
    ])
      expect(
        (await validate(plainToInstance(ReportQuery, extra), options)).length,
      ).toBeGreaterThan(0);
  });
  it('limits export kinds to the reviewed allowlist', async () => {
    for (const kind of ['vehicles', 'customers', 'rentals', 'movements'])
      expect(
        await validate(plainToInstance(ReportExportParams, { kind }), options),
      ).toEqual([]);
    for (const kind of ['audit', 'users', '../x', ''])
      expect(
        (await validate(plainToInstance(ReportExportParams, { kind }), options))
          .length,
      ).toBeGreaterThan(0);
  });
});

describe('report window', () => {
  it('defaults to the previous 30 days', () => {
    const w = reportWindow({}, now);
    expect(w.until).toEqual(now);
    expect(now.getTime() - w.from.getTime()).toBe(30 * 86_400_000);
  });
  it('rejects inverted, equal and oversized ranges', () => {
    for (const q of [
      { from: '2026-11-02T00:00:00Z', until: '2026-11-01T00:00:00Z' },
      { from: '2026-11-01T00:00:00Z', until: '2026-11-01T00:00:00Z' },
      { from: '2025-01-01T00:00:00Z', until: '2026-11-01T00:00:00Z' },
    ])
      expect(() => reportWindow(q, now)).toThrow();
    expect(() =>
      reportWindow(
        { from: '2025-11-01T00:00:00Z', until: '2026-11-01T00:00:00Z' },
        now,
      ),
    ).not.toThrow();
  });
});

describe('report authorization boundaries', () => {
  it('uses verified tenant guards and report.read on every endpoint', () => {
    expect(Reflect.getMetadata('__guards__', ReportsController)).toEqual([
      AuthGuard,
      TenantGuard,
      PermissionGuard,
    ]);
    for (const name of ['summary', 'export'])
      expect(
        Reflect.getMetadata(
          'permission',
          Object.getOwnPropertyDescriptor(ReportsController.prototype, name)
            ?.value as object,
        ),
      ).toBe('report.read');
  });
  it('grants report.read to Owner only', () => {
    expect(permissionsFor('OWNER')).toContain('report.read');
    for (const role of ['CUSTOMER', 'PLATFORM_OPERATOR', 'ADMIN'])
      expect(permissionsFor(role)).not.toContain('report.read');
  });
});
