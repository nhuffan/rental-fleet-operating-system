import { BadRequestException, ConflictException } from '@nestjs/common';
import type { MovementCategory, MovementKind } from './dto.js';
export const commercialConflict = (code: string, message: string) =>
  new ConflictException({ code, message });
export function requireCategory(
  kind: MovementKind,
  category: MovementCategory,
  rentalId?: string,
) {
  const allowed: Record<MovementKind, readonly MovementCategory[]> = {
    RENTAL_PAYMENT: ['RENTAL'],
    MISC_INCOME: ['OTHER_INCOME'],
    DEPOSIT_RECEIPT: ['DEPOSIT'],
    DEPOSIT_REFUND: ['DEPOSIT'],
    DEPOSIT_RETAIN: ['DEPOSIT'],
    EXPENSE: ['FUEL', 'MAINTENANCE', 'TOLL', 'INSURANCE', 'OTHER_EXPENSE'],
  };
  if (!allowed[kind]?.includes(category))
    throw new BadRequestException({
      code: 'INVALID_COMMERCIAL_CATEGORY',
      message: 'Category does not match movement kind',
    });
  if ((kind === 'RENTAL_PAYMENT' || kind.startsWith('DEPOSIT_')) && !rentalId)
    throw new BadRequestException({
      code: 'COMMERCIAL_RENTAL_REQUIRED',
      message: 'Rental is required for this movement',
    });
}
/** Rental Core keeps decimal amounts. Commercial comparison rounds nonnegative VND half up, exactly. */
export function roundRentalVnd(value: string): string {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error('Invalid persisted rental amount');
  const [whole, fraction = ''] = value.split('.');
  return (
    BigInt(whole) + (fraction.padEnd(2, '0') >= '50' ? 1n : 0n)
  ).toString();
}
export function outstanding(contracted: string, received: string) {
  const difference = BigInt(contracted) - BigInt(received);
  return {
    outstandingAmount: (difference > 0n ? difference : 0n).toString(),
    overpaidAmount: (difference < 0n ? -difference : 0n).toString(),
  };
}
