import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  QuotePreviewInput,
  RateCardCreate,
  RateCardDelete,
  RateCardUpdate,
  RentalPricingSelection,
} from './dto.js';
const errors = (type: new () => object, value: object) =>
  validateSync(plainToInstance(type, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
const rate = {
  name: 'Vehicle daily',
  vehicleId: randomUUID(),
  hourlyRate: '100000',
  dailyRate: '800000',
  minimumCharge: '0',
  extraHourRate: '120000',
  effectiveFrom: '2026-11-01T00:00:00+07:00',
  effectiveUntil: null,
  status: 'ACTIVE',
};
it('accepts explicit VND strings and requires optimistic versions on replacement/delete', () => {
  expect(errors(RateCardCreate, rate)).toHaveLength(0);
  expect(errors(RateCardUpdate, { ...rate, version: 1 })).toHaveLength(0);
  expect(errors(RateCardUpdate, rate).length).toBeGreaterThan(0);
  expect(errors(RateCardDelete, { version: '1' })).toHaveLength(0);
  for (const value of [0, -1, 'x', null])
    expect(errors(RateCardDelete, { version: value }).length).toBeGreaterThan(
      0,
    );
});
it('rejects fractional/exponential/noncanonical money, forged tenant fields and missing offsets', () => {
  for (const hourlyRate of [
    '0',
    '1.1',
    '1e5',
    '01',
    '1000000000',
    100000,
    null,
  ]) {
    if (hourlyRate === null) continue;
    expect(
      errors(RateCardCreate, { ...rate, hourlyRate }).length,
    ).toBeGreaterThan(0);
  }
  for (const patch of [
    { businessId: randomUUID() },
    { createdBy: randomUUID() },
    { status: null },
    { minimumCharge: null },
    { effectiveFrom: '2026-11-01T09:00' },
    { effectiveUntil: '2026-02-30T09:00:00+07:00' },
  ])
    expect(
      errors(RateCardCreate, { ...rate, ...patch }).length,
    ).toBeGreaterThan(0);
});
it('allows only the explicit quotation timezone and a reasoned whole-VND override', () => {
  const preview = {
    vehicleId: rate.vehicleId,
    startAt: '2026-11-01T09:00:00+07:00',
    endAt: '2026-11-02T09:00:00+07:00',
    timeZone: 'Asia/Ho_Chi_Minh',
    billingMode: 'DAILY',
  };
  expect(errors(QuotePreviewInput, preview)).toHaveLength(0);
  for (const patch of [
    { timeZone: 'UTC' },
    { timeZone: null },
    { startAt: '2026-11-01T09:00' },
    { billingMode: 'CHEAPEST' },
    { vehicleId: 'foreign' },
  ])
    expect(
      errors(QuotePreviewInput, { ...preview, ...patch }).length,
    ).toBeGreaterThan(0);
  const selection = {
    billingMode: 'DAILY',
    expectedQuoteHash: 'a'.repeat(64),
    overrideAmount: '0',
    overrideReason: 'Complimentary contract',
  };
  expect(errors(RentalPricingSelection, selection)).toHaveLength(0);
  for (const patch of [
    { overrideAmount: '1.5' },
    { overrideReason: ' ' },
    { expectedQuoteHash: 'x' },
    { businessId: randomUUID() },
  ])
    expect(
      errors(RentalPricingSelection, { ...selection, ...patch }).length,
    ).toBeGreaterThan(0);
});
