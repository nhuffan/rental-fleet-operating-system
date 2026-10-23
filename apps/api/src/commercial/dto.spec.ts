import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CommercialMovementCreate,
  CommercialMovementQuery,
  CommercialMovementReverse,
} from './dto.js';
const options = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};
const body = {
  kind: 'MISC_INCOME',
  category: 'OTHER_INCOME',
  amount: '999999999999999',
  occurredAt: '2026-10-23T00:00:00+07:00',
};
it('accepts exact whole VND strings and rejects fractional, negative, numeric or oversized amounts', async () => {
  expect(
    await validate(plainToInstance(CommercialMovementCreate, body), options),
  ).toEqual([]);
  for (const amount of [
    0,
    123,
    '0',
    '-1',
    '1.50',
    '001',
    '1e5',
    '1000000000000000',
    null,
  ])
    expect(
      (
        await validate(
          plainToInstance(CommercialMovementCreate, { ...body, amount }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
});
it('requires explicit timezone, rejects impossible dates and unknown tenant/status inputs', async () => {
  for (const extra of [
    { occurredAt: '2026-10-23T00:00:00' },
    { occurredAt: '2026-02-30T00:00:00Z' },
    { businessId: 'forged' },
    { reversalOf: 'forged' },
    { status: 'POSTED' },
    { vehicleId: null },
  ])
    expect(
      (
        await validate(
          plainToInstance(CommercialMovementCreate, { ...body, ...extra }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
});
it('bounds pagination, literal search and reversal reasons', async () => {
  expect(
    (
      await validate(
        plainToInstance(CommercialMovementQuery, { limit: 101 }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (
      await validate(
        plainToInstance(CommercialMovementQuery, { search: 'x'.repeat(101) }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (
      await validate(
        plainToInstance(CommercialMovementReverse, { reason: '  ' }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
});
