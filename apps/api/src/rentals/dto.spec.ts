import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CustomerCreate,
  CustomerUpdate,
  RentalCreate,
  RentalExtend,
  RentalHandover,
  RentalInspectionInput,
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

const validInspection = {
  fuelPercent: 75,
  exteriorCondition: 'GOOD',
  interiorCondition: 'GOOD',
  spareTire: 'NOT_APPLICABLE',
  tools: 'PRESENT',
  registrationDocument: 'PRESENT',
  insuranceDocument: 'MISSING',
  keys: 'PRESENT',
};
it('requires a full inspection on both lifecycle actions and trims optional notes', async () => {
  for (const [dto, body] of [
    [RentalHandover, { odometerStart: 100 }],
    [RentalReturn, { odometerEnd: 150 }],
  ] as const) {
    for (const inspection of [undefined, null, {}, [], 'unset'])
      expect(
        (
          await validate(
            plainToInstance<RentalHandover | RentalReturn, unknown>(dto, {
              ...body,
              inspection,
            }),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance<RentalHandover | RentalReturn, unknown>(dto, {
          ...body,
          inspection: validInspection,
        }),
        options,
      ),
    ).toEqual([]);
  }
  const inspection = plainToInstance(RentalInspectionInput, {
    ...validInspection,
    damageNotes: ' small dent ',
    notes: ' private note ',
  });
  expect(inspection.damageNotes).toBe('small dent');
  expect(inspection.notes).toBe('private note');
  expect(await validate(inspection, options)).toEqual([]);
});
it.each([
  { fuelPercent: -1 },
  { fuelPercent: 101 },
  { fuelPercent: 50.5 },
  { fuelPercent: '50' },
  { exteriorCondition: 'NOT_APPLICABLE' },
  { interiorCondition: null },
  { tools: undefined },
  { keys: '' },
  { spareTire: true },
  { registrationDocument: 'UNSET' },
  { insuranceDocument: null },
  { exteriorCondition: 'DAMAGED' },
  { interiorCondition: 'DAMAGED', damageNotes: '   ' },
  { damageNotes: null },
  { damageNotes: 'x'.repeat(2001) },
  { notes: null },
  { notes: 'x'.repeat(2001) },
  { actorId: validRental.customerId },
  { businessId: validRental.customerId },
  { rentalId: validRental.customerId },
  { vehicleId: validRental.vehicleId },
  { type: 'HANDOVER' },
  { recordedAt: validRental.startAt },
  { odometer: 1 },
])(
  'rejects invalid, incomplete or spoofed inspection fields %#',
  async (fields) => {
    expect(
      (
        await validate(
          plainToInstance(RentalHandover, {
            odometerStart: 100,
            inspection: { ...validInspection, ...fields },
          }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  },
);
it('accepts endpoint fuel boundaries and explicit damaged conditions with required nonblank notes', async () => {
  for (const fuelPercent of [0, 100])
    expect(
      await validate(
        plainToInstance(RentalInspectionInput, {
          ...validInspection,
          fuelPercent,
          exteriorCondition: 'DAMAGED',
          damageNotes: ' Dent on rear door ',
        }),
        options,
      ),
    ).toEqual([]);
});

it('trims optional identity fields and rejects oversized or null paper details', async () => {
  const value = plainToInstance(CustomerUpdate, {
    idNumber: ' 012345 ',
    address: ' Address ',
    driverLicenseNumber: ' DL123 ',
    driverLicenseClass: ' B2 ',
  });
  expect(await validate(value, options)).toHaveLength(0);
  expect(value).toMatchObject({
    idNumber: '012345',
    address: 'Address',
    driverLicenseNumber: 'DL123',
    driverLicenseClass: 'B2',
  });
  for (const field of [
    'idNumber',
    'driverLicenseNumber',
    'driverLicenseClass',
    'address',
  ]) {
    expect(
      await validate(
        plainToInstance(CustomerUpdate, { [field]: null }),
        options,
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CustomerUpdate, { [field]: 'X'.repeat(501) }),
        options,
      ),
    ).not.toHaveLength(0);
  }
});
