import {
  blocksRental,
  isOverdue,
  rentalWindow,
  requireRentalStatus,
} from './domain.js';
const date = (hours: number) =>
  new Date(`2026-10-22T${String(hours).padStart(2, '0')}:00:00Z`);
it('treats time ranges as UTC half-open intervals with adjacent bookings allowed', () => {
  const rental = { status: 'RESERVED', startAt: date(8), endAt: date(10) };
  expect(blocksRental(rental, date(10), date(12), date(9))).toBe(false);
  expect(blocksRental(rental, date(6), date(8), date(9))).toBe(false);
  expect(blocksRental(rental, date(9), date(12), date(9))).toBe(true);
  expect(rentalWindow('2026-10-22T15:00:00+07:00', date(10)).startAt).toEqual(
    date(8),
  );
});
it('derives overdue only for unreturned ACTIVE rentals and keeps their release time unknown', () => {
  const rental = { status: 'ACTIVE', startAt: date(8), endAt: date(10) };
  expect(isOverdue(rental, date(10))).toBe(true);
  expect(blocksRental(rental, date(14), date(16), date(11))).toBe(true);
  expect(blocksRental(rental, date(14), date(16), date(9))).toBe(false);
  expect(blocksRental(rental, date(6), date(8), date(11))).toBe(false);
  for (const status of ['DRAFT', 'CANCELLED', 'COMPLETED']) {
    expect(isOverdue({ ...rental, status }, date(11))).toBe(false);
    expect(
      blocksRental({ ...rental, status }, date(8), date(9), date(11)),
    ).toBe(false);
  }
});
it('rejects invalid dates, zero/backward windows and repeated or terminal transitions', () => {
  for (const [start, end] of [
    ['invalid', date(10)],
    [date(10), date(10)],
    [date(10), date(8)],
  ] as const)
    expect(() => rentalWindow(start, end)).toThrow();
  for (const status of ['ACTIVE', 'COMPLETED', 'CANCELLED'])
    expect(() => requireRentalStatus(status, ['DRAFT', 'RESERVED'])).toThrow();
});
