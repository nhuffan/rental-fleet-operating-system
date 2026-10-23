import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CustomerCreate,
  CustomerUpdate,
  RentalCreate,
  RentalExtend,
  RentalHandover,
  RentalQuery,
  RentalReturn,
  RentalUpdate,
  VehicleAvailabilityQuery,
} from './dto.js';
const options = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};
const validRental = {
  customerId: 'e2b3adbf-f578-4fae-8589-04a055473d8c',
  vehicleId: 'e2b3adbf-f578-4fae-8589-04a055473d8d',
  startAt: '2026-10-22T09:00:00+07:00',
  endAt: '2026-10-23T02:00:00Z',
};
it('canonicalizes customer contacts and preserves explicit empty contact fields for merged validation', async () => {
  const customer = plainToInstance(CustomerCreate, {
    name: ' Customer ',
    phone: ' +84 123-456 ',
    email: ' Person@Example.Test ',
    notes: ' Note ',
  });
  expect(customer).toMatchObject({
    name: 'Customer',
    phone: '+84 123-456',
    email: 'person@example.test',
    notes: 'Note',
  });
  expect(await validate(customer, options)).toEqual([]);
  expect(
    await validate(
      plainToInstance(CustomerUpdate, {
        phone: '',
        email: 'valid@example.test',
      }),
      options,
    ),
  ).toEqual([]);
});
it.each([
  { name: ' ' },
  { name: 'Valid', phone: 'call-me' },
  { name: 'Valid', email: 'not-an-email' },
  { name: 'Valid', businessId: 'forged' },
  { name: 'Valid', status: 'DISABLED' },
  { name: 'Valid', email: null },
])('rejects malformed customer or tenant injection %#', async (body) => {
  expect(
    (await validate(plainToInstance(CustomerCreate, body), options)).length,
  ).toBeGreaterThan(0);
});
it('accepts explicit timezone dates, bounded decimal money and concrete booleans', async () => {
  expect(
    await validate(
      plainToInstance(RentalCreate, {
        ...validRental,
        rentalAmount: 999999999.99,
        depositRequiredAmount: 0.01,
        depositReceived: false,
      }),
      options,
    ),
  ).toEqual([]);
  expect(plainToInstance(RentalQuery, { overdue: 'false' }).overdue).toBe(
    false,
  );
  expect(
    plainToInstance(VehicleAvailabilityQuery, {
      ...validRental,
      availableOnly: 'true',
    }).availableOnly,
  ).toBe(true);
});
it.each([
  { status: 'ACTIVE' },
  { businessId: 'forged' },
  { rentalAmount: -1 },
  { rentalAmount: 0.001 },
  { rentalAmount: 1000000000 },
  { rentalAmount: '12' },
  { rentalAmount: Infinity },
  { depositReceived: 'true' },
  { startAt: '2026-10-22T09:00:00' },
  { startAt: '2026-02-30T09:00:00Z' },
  { startAt: null },
  { endAt: 'infinity' },
])('rejects unsafe rental payload %#', async (fields) => {
  expect(
    (
      await validate(
        plainToInstance(RentalCreate, { ...validRental, ...fields }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
});
it('protects workflow timestamps, lifecycle and odometer values from update injection', async () => {
  for (const fields of [
    { status: 'ACTIVE' },
    { reservedAt: validRental.startAt },
    { handedOverAt: validRental.startAt },
    { odometerStart: 123 },
  ])
    expect(
      (await validate(plainToInstance(RentalUpdate, fields), options)).length,
    ).toBeGreaterThan(0);
  expect(
    (
      await validate(
        plainToInstance(RentalHandover, { odometerStart: -1 }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (
      await validate(
        plainToInstance(RentalReturn, { odometerEnd: 2147483648 }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (
      await validate(
        plainToInstance(RentalExtend, {
          endAt: validRental.endAt,
          rentalAmount: 1.001,
        }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
});
it('rejects invalid pagination, ambiguous booleans and forged availability query fields', async () => {
  expect(
    (
      await validate(
        plainToInstance(RentalQuery, {
          overdue: 'yes',
          sort: 'notes',
          limit: 101,
        }),
        options,
      )
    ).length,
  ).toBe(3);
  expect(
    (
      await validate(
        plainToInstance(VehicleAvailabilityQuery, {
          startAt: validRental.startAt,
          endAt: validRental.endAt,
          businessId: 'forged',
        }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
});
