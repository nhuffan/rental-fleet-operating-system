import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PageQuery } from '../core/dto.js';
export const COMMERCIAL_KINDS = [
  'RENTAL_PAYMENT',
  'MISC_INCOME',
  'DEPOSIT_RECEIPT',
  'DEPOSIT_REFUND',
  'DEPOSIT_RETAIN',
  'EXPENSE',
] as const;
export const COMMERCIAL_CATEGORIES = [
  'RENTAL',
  'OTHER_INCOME',
  'DEPOSIT',
  'FUEL',
  'MAINTENANCE',
  'TOLL',
  'INSURANCE',
  'OTHER_EXPENSE',
] as const;
export const COMMERCIAL_STATUSES = ['POSTED', 'REVERSED', 'REVERSAL'] as const;
export type MovementKind = (typeof COMMERCIAL_KINDS)[number];
export type MovementCategory = (typeof COMMERCIAL_CATEGORIES)[number];
const optional = (_o: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const timezoneDate = /T.*(?:Z|[+-]\d{2}:\d{2})$/;
export class CommercialMovementCreate {
  @ApiProperty({ enum: COMMERCIAL_KINDS })
  @IsIn(COMMERCIAL_KINDS)
  kind!: MovementKind;
  @ApiProperty({ enum: COMMERCIAL_CATEGORIES })
  @IsIn(COMMERCIAL_CATEGORIES)
  category!: MovementCategory;
  @ApiProperty({
    type: String,
    pattern: '^[1-9][0-9]{0,14}$',
    description:
      'Exact whole VND, positive integer string, maximum 999999999999999.',
  })
  @IsString()
  @Matches(/^[1-9][0-9]{0,14}$/)
  amount!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'Explicit UTC offset; cannot be later than database time.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  occurredAt!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for rental payments and deposit movements. Derives vehicleId.',
  })
  @ValidateIf(optional)
  @IsUUID()
  rentalId?: string;
  @ApiPropertyOptional({ default: '' })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 160)
  reference?: string;
  @ApiPropertyOptional({ default: '' })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 2000)
  notes?: string;
}
export class CommercialMovementReverse {
  @ApiProperty({
    description:
      'Correction reason; saved in reversal notes, never audit metadata.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  reason!: string;
}
export class CommercialSummaryQuery {
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Inclusive, omitted means all history. Does not bound deposit liability.',
  })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  from?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Exclusive, defaults to database time.',
  })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  until?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  rentalId?: string;
}
export class CommercialMovementQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  from?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  until?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  rentalId?: string;
  @ApiPropertyOptional({ enum: COMMERCIAL_KINDS })
  @ValidateIf(optional)
  @IsIn(COMMERCIAL_KINDS)
  kind?: MovementKind;
  @ApiPropertyOptional({ enum: COMMERCIAL_CATEGORIES })
  @ValidateIf(optional)
  @IsIn(COMMERCIAL_CATEGORIES)
  category?: MovementCategory;
  @ApiPropertyOptional({ enum: COMMERCIAL_STATUSES })
  @ValidateIf(optional)
  @IsIn(COMMERCIAL_STATUSES)
  status?: string;
  @ApiPropertyOptional({
    description: 'Literal reference/notes substring, maximum 100 characters.',
  })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 100)
  search?: string;
}
