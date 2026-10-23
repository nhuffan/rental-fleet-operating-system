import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DeviceAssignmentCreate,
  GpsDeviceCreate,
  GpsDeviceQuery,
  GpsDeviceUpdate,
  VehicleCreate,
  VehicleQuery,
  VehicleUpdate,
} from './dto.js';
const options = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};
describe('Fleet request validation', () => {
  it('canonicalizes plates, provider and tracker UID without changing UID case', async () => {
    const vehicle = plainToInstance(VehicleCreate, {
      licensePlate: ' 51a - 123.45 ',
      make: ' Toyota ',
      model: ' Vios ',
    });
    expect(vehicle.licensePlate).toBe('51A12345');
    expect(vehicle.make).toBe('Toyota');
    expect(await validate(vehicle, options)).toEqual([]);
    const device = plainToInstance(GpsDeviceCreate, {
      provider: ' Manual ',
      deviceUid: ' AbC-12:3 ',
    });
    expect(device.provider).toBe('manual');
    expect(device.deviceUid).toBe('AbC-12:3');
    expect(await validate(device, options)).toEqual([]);
  });
  it.each([
    { licensePlate: 'A/123', make: 'Toyota', model: 'Vios' },
    { licensePlate: '51A12345', make: ' ', model: 'Vios' },
    { licensePlate: null, make: 'Toyota', model: 'Vios' },
    {
      licensePlate: '51A12345',
      make: 'Toyota',
      model: 'Vios',
      businessId: 'forged',
    },
    {
      licensePlate: '51A12345',
      make: 'Toyota',
      model: 'Vios',
      status: 'AVAILABLE',
    },
  ])('rejects invalid vehicle input %#', async (body) => {
    expect(
      (await validate(plainToInstance(VehicleCreate, body), options)).length,
    ).toBeGreaterThan(0);
  });
  it('permits clearing a branch but rejects null fields and invalid sort keys', async () => {
    expect(
      await validate(
        plainToInstance(VehicleUpdate, { branchId: null }),
        options,
      ),
    ).toEqual([]);
    expect(
      (await validate(plainToInstance(VehicleUpdate, { make: null }), options))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(VehicleQuery, { sort: 'businessId', limit: 101 }),
          options,
        )
      ).length,
    ).toBe(2);
  });
  it('parses booleans explicitly and rejects ambiguous or forged query fields', async () => {
    expect(
      plainToInstance(GpsDeviceQuery, { available: 'false' }).available,
    ).toBe(false);
    expect(
      plainToInstance(GpsDeviceQuery, { available: 'true' }).available,
    ).toBe(true);
    expect(
      (
        await validate(
          plainToInstance(GpsDeviceQuery, { available: 'yes' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(GpsDeviceQuery, { businessId: 'forged' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('protects device identity, ownership and assignment timestamps from PATCH/body injection', async () => {
    for (const body of [
      { provider: 'other' },
      { deviceUid: 'other' },
      { businessId: 'forged' },
    ]) {
      expect(
        (await validate(plainToInstance(GpsDeviceUpdate, body), options))
          .length,
      ).toBeGreaterThan(0);
    }
    expect(
      (
        await validate(
          plainToInstance(DeviceAssignmentCreate, {
            deviceId: 'e2b3adbf-f578-4fae-8589-04a055473d8c',
            assignedAt: new Date().toISOString(),
          }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
