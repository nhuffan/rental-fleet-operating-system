import { outstanding, requireCategory, roundRentalVnd } from './domain.js';
it('rounds Rental Core decimal amounts half up without floating point', () => {
  for (const [input, expected] of [
    ['0', '0'],
    ['0.49', '0'],
    ['0.50', '1'],
    ['125.55', '126'],
    ['999999999.99', '1000000000'],
  ])
    expect(roundRentalVnd(input)).toBe(expected);
});
it('reconciles outstanding and overpaid amounts exactly above safe-number totals', () => {
  expect(outstanding('100000000000000000', '99999999999999999')).toEqual({
    outstandingAmount: '1',
    overpaidAmount: '0',
  });
  expect(outstanding('100', '120')).toEqual({
    outstandingAmount: '0',
    overpaidAmount: '20',
  });
});
it('requires rental scope for deposit and rental cash and prevents category ambiguity', () => {
  expect(() => requireCategory('DEPOSIT_RECEIPT', 'DEPOSIT')).toThrow();
  expect(() => requireCategory('RENTAL_PAYMENT', 'RENTAL')).toThrow();
  expect(() => requireCategory('EXPENSE', 'DEPOSIT', 'rental')).toThrow();
  expect(() =>
    requireCategory('DEPOSIT_RETAIN', 'DEPOSIT', 'rental'),
  ).not.toThrow();
  expect(() => requireCategory('EXPENSE', 'TOLL')).not.toThrow();
});
