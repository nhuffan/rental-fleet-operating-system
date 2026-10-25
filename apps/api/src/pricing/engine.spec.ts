import {
  calculateQuote,
  createQuoteHash,
  parsePricingInstant,
  type RateInput,
  type QuoteInput,
} from './engine.js';
const rate: RateInput = {
  id: 'rate-one',
  name: 'Vehicle rate',
  version: 1,
  scope: 'VEHICLE',
  hourlyRate: '100001',
  dailyRate: '900007',
  minimumCharge: '0',
  extraHourRate: null,
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveUntil: null,
};
const input: QuoteInput = {
  vehicleId: 'vehicle-one',
  startAt: '2026-10-25T10:00:00+07:00',
  endAt: '2026-10-26T10:00:00+07:00',
};
const quote = (
  durationMs: number,
  changes: Partial<RateInput> = {},
  billingMode: 'DAILY' | 'HOURLY' = 'DAILY',
) =>
  calculateQuote(
    { ...rate, ...changes },
    {
      ...input,
      billingMode,
      endAt: new Date(
        parsePricingInstant(input.startAt).getTime() + durationMs,
      ).toISOString(),
    },
  );
it('rounds partial hours upward exactly, including a single millisecond', () => {
  expect(quote(1, {}, 'HOURLY').calculatedAmount).toBe('100001');
  expect(quote(1, {}, 'HOURLY').durationSeconds).toBe('0.001');
  expect(quote(3600000, {}, 'HOURLY').calculatedAmount).toBe('100001');
  expect(quote(3600001, {}, 'HOURLY').calculatedAmount).toBe('200002');
});
it('rounds daily units over elapsed24-hour boundaries without local midnight rules', () => {
  expect(quote(1).calculatedAmount).toBe('900007');
  expect(quote(86400000).calculatedAmount).toBe('900007');
  expect(quote(86400001).calculatedAmount).toBe('1800014');
  const q = calculateQuote(rate, {
    ...input,
    startAt: '2026-10-25T23:30:00+07:00',
    endAt: '2026-10-26T00:30:00+07:00',
  });
  expect(q.lines).toEqual([
    { kind: 'DAY', units: '1', unitPrice: '900007', amount: '900007' },
  ]);
});
it('caps rounded extra hours at one daily rate and handles subday rentals', () => {
  expect(quote(86400001, { extraHourRate: '100001' }).lines).toEqual([
    { kind: 'DAY', units: '1', unitPrice: '900007', amount: '900007' },
    { kind: 'EXTRA_HOUR', units: '1', unitPrice: '100001', amount: '100001' },
  ]);
  expect(quote(10 * 3600000, { extraHourRate: '100001' }).lines).toEqual([
    { kind: 'DAY_CAP', units: '1', unitPrice: '900007', amount: '900007' },
  ]);
  expect(quote(3600001, { extraHourRate: '100001' }).calculatedAmount).toBe(
    '200002',
  );
});
it('itemizes minimum adjustment and never changes actual money movements', () => {
  const q = quote(1, { minimumCharge: '400003', extraHourRate: '100001' });
  expect(q.calculatedAmount).toBe('400003');
  expect(q.lines.at(-1)).toEqual({
    kind: 'MINIMUM',
    units: '1',
    unitPrice: '300002',
    amount: '300002',
  });
  expect(q.currency).toBe('VND');
  expect(q.timeZone).toBe('Asia/Ho_Chi_Minh');
});
it('uses integer arithmetic up to the existing rental amount cap', () => {
  expect(quote(1, { hourlyRate: '999999999' }, 'HOURLY').calculatedAmount).toBe(
    '999999999',
  );
  expect(() => quote(3600001, { hourlyRate: '999999999' }, 'HOURLY')).toThrow(
    'PRICING_AMOUNT_EXCEEDED',
  );
  for (const value of ['1.5', '-1', '1e3', '01', 'NaN', '1000000000', '0'])
    expect(() => quote(1, { hourlyRate: value }, 'HOURLY')).toThrow(
      'INVALID_PRICING_RATE',
    );
});
it('validates calendar dates, offsets, units and effective pickup bounds', () => {
  for (const value of [
    '2026-02-29T12:00:00+07:00',
    '2026-04-31T00:00:00Z',
    '2026-10-25T24:00:00Z',
    '2026-10-25T12:00:00',
    '2026-10-25T12:00:00+14:01',
    '2026-10-25T12:00:00+15:00',
    '2026-10-25T12:00:00.0001Z',
  ])
    expect(() => parsePricingInstant(value)).toThrow('INVALID_PRICING_TIME');
  expect(parsePricingInstant('2024-02-29T12:00:00+07:00').toISOString()).toBe(
    '2024-02-29T05:00:00.000Z',
  );
  expect(() =>
    calculateQuote(rate, { ...input, endAt: input.startAt }),
  ).toThrow('INVALID_PRICING_TIME');
  expect(() =>
    calculateQuote({ ...rate, effectiveUntil: input.startAt }, input),
  ).toThrow('RATE_NOT_EFFECTIVE');
  expect(
    calculateQuote(
      {
        ...rate,
        effectiveFrom: input.startAt,
        effectiveUntil: '2026-10-25T11:00:00+07:00',
      },
      input,
    ).calculatedAmount,
  ).toBe('900007');
  expect(() => quote(1, { hourlyRate: null }, 'HOURLY')).toThrow(
    'BILLING_MODE_UNAVAILABLE',
  );
  expect(() =>
    quote(1, { dailyRate: null, extraHourRate: '1' }, 'HOURLY'),
  ).toThrow('INVALID_PRICING_RATE');
});
it('hashes the full normalized selection/rate snapshot and preserves detached old breakdowns', () => {
  const before = calculateQuote(rate, input);
  expect(
    calculateQuote(rate, {
      ...input,
      startAt: '2026-10-25T03:00:00Z',
      endAt: '2026-10-26T03:00:00Z',
    }),
  ).toEqual(before);
  for (const changes of [
    { version: 2 },
    { dailyRate: '900008' },
    { scope: 'BUSINESS' as const },
    { name: 'Renamed' },
  ])
    expect(calculateQuote({ ...rate, ...changes }, input).quoteHash).not.toBe(
      before.quoteHash,
    );
  expect(
    calculateQuote(rate, { ...input, vehicleId: 'vehicle-two' }).quoteHash,
  ).not.toBe(before.quoteHash);
  expect(before.calculatedAmount).toBe('900007');
  expect(createQuoteHash(['missing', input.vehicleId])).toMatch(
    /^[a-f0-9]{64}$/,
  );
});
