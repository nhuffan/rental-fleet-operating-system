import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TripQuery, TripRouteQuery } from './dto.js';
it('validates bounded pagination, explicit UTC offsets and read filters', async () => {
  expect(
    await validate(
      plainToInstance(TripQuery, {
        from: '2026-10-23T01:00:00+07:00',
        to: '2026-10-23T02:00:00Z',
        sort: 'asc',
        page: '2',
        limit: '100',
      }),
    ),
  ).toHaveLength(0);
  for (const input of [
    { from: '2026-10-23' },
    { from: '2026-10-23T01:00:00' },
    { vehicleId: 'no' },
    { rentalId: 'no' },
    { limit: '101' },
    { page: '0' },
    { sort: 'random' },
  ])
    expect(
      (await validate(plainToInstance(TripQuery, input))).length,
    ).toBeGreaterThan(0);
  expect(
    await validate(plainToInstance(TripRouteQuery, { limit: '500' })),
  ).toHaveLength(0);
  expect(
    (await validate(plainToInstance(TripRouteQuery, { limit: '501' }))).length,
  ).toBeGreaterThan(0);
});
