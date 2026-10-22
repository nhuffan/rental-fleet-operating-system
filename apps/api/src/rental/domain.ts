import { BadRequestException, ConflictException } from '@nestjs/common';
export const rentalConflict = (code: string, message: string) =>
  new ConflictException({ code, message });
export function rentalWindow(start: string | Date, end: string | Date) {
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (
    !Number.isFinite(startAt.getTime()) ||
    !Number.isFinite(endAt.getTime()) ||
    endAt <= startAt
  )
    throw new BadRequestException({
      code: 'INVALID_RENTAL_RANGE',
      message: 'Rental end must be later than its start',
    });
  return { startAt, endAt };
}
export function requireRentalStatus(
  actual: string,
  allowed: readonly string[],
) {
  if (!allowed.includes(actual))
    throw rentalConflict(
      'INVALID_RENTAL_STATE',
      'This action is not allowed in the current rental state',
    );
}
export function isOverdue(rental: { status: string; endAt: Date }, now: Date) {
  return rental.status === 'ACTIVE' && rental.endAt <= now;
}
/** Half-open intervals permit adjacent bookings. An unreturned overdue rental has no known release time. */
export function blocksRental(
  rental: { status: string; startAt: Date; endAt: Date },
  startAt: Date,
  endAt: Date,
  now: Date,
) {
  return (
    (rental.status === 'RESERVED' || rental.status === 'ACTIVE') &&
    rental.startAt < endAt &&
    (rental.endAt > startAt || isOverdue(rental, now))
  );
}
