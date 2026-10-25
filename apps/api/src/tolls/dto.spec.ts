import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  TollBulkRecord,
  TollImportPreview,
  TollRecord,
  TollReview,
} from './dto.js';
import { randomUUID } from 'node:crypto';
const errors = (type: new () => object, value: object) =>
  validateSync(plainToInstance(type, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
it('requires explicit nullable associations, review version/reason and real boolean acknowledgement', () => {
  const body = {
    vehicleId: randomUUID(),
    rentalId: null,
    ignore: false,
    reason: 'Verified',
    version: 1,
  };
  expect(errors(TollReview, body)).toHaveLength(0);
  for (const change of [
    { reason: ' ' },
    { version: 0 },
    { ignore: 'false' },
    { businessId: randomUUID() },
  ])
    expect(errors(TollReview, { ...body, ...change }).length).toBeGreaterThan(
      0,
    );
  expect(
    errors(TollReview, {
      reason: 'Missing associations',
      ignore: false,
      version: 1,
    }).length,
  ).toBeGreaterThan(0);
  expect(
    errors(TollRecord, {
      reason: 'Approve',
      version: 1,
      acknowledgePossibleDuplicate: 'true',
    }).length,
  ).toBeGreaterThan(0);
});
it('bounds CSV mapping/nested inputs and selected bulk IDs', () => {
  const body = {
    source: 'CSV',
    csv: 'plate,time,amount',
    delimiter: ',',
    mapping: { plate: 0, occurredAt: 1, amount: 2 },
    dateFormat: 'ISO_OFFSET',
    amountFormat: 'INTEGER',
  };
  expect(errors(TollImportPreview, body)).toHaveLength(0);
  expect(
    errors(TollImportPreview, {
      ...body,
      mapping: { ...body.mapping, forged: 1 },
    }).length,
  ).toBeGreaterThan(0);
  expect(
    errors(TollBulkRecord, {
      items: Array.from({ length: 21 }, () => ({
        id: randomUUID(),
        version: 1,
      })),
      reason: 'Approve',
    }).length,
  ).toBeGreaterThan(0);
  const item = { id: randomUUID(), version: 1 };
  expect(
    errors(TollBulkRecord, { items: [item, item], reason: 'Approve' }).length,
  ).toBeGreaterThan(0);
});
