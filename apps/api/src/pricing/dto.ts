import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { PageQuery } from '../core/dto.js';

const optional = (_o: unknown, value: unknown) => value !== undefined;
const nullable = (_o: unknown, value: unknown) =>
  value !== undefined && value !== null;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const offsetDate = /T.*(?:Z|[+-]\d{2}:\d{2})$/;
export const BILLING_MODES = ['HOURLY', 'DAILY'] as const;
export const MAX_PRICING_AMOUNT = '999999999';
export class RateCardCreate {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name!: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Null uses the business default scope.',
  })
  @ValidateIf(nullable)
  @IsUUID()
  vehicleId?: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^[1-9][0-9]{0,8}$',
  })
  @ValidateIf(nullable)
  @Matches(/^[1-9][0-9]{0,8}$/)
  hourlyRate?: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^[1-9][0-9]{0,8}$',
  })
  @ValidateIf(nullable)
  @Matches(/^[1-9][0-9]{0,8}$/)
  dailyRate?: string | null;
  @ApiPropertyOptional({ default: '0', pattern: '^(0|[1-9][0-9]{0,8})$' })
  @ValidateIf(optional)
  @Matches(/^(0|[1-9][0-9]{0,8})$/)
  minimumCharge?: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^[1-9][0-9]{0,8}$',
    description:
      'Daily remainder is charged in commenced hours, capped at one daily rate.',
  })
  @ValidateIf(nullable)
  @Matches(/^[1-9][0-9]{0,8}$/)
  extraHourRate?: string | null;
  @ApiProperty({
    format: 'date-time',
    description: 'Inclusive pickup-time eligibility, with explicit offset.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(offsetDate)
  effectiveFrom!: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'date-time',
    description: 'Exclusive upper bound; null has no scheduled end.',
  })
  @ValidateIf(nullable)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(offsetDate)
  effectiveUntil?: string | null;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
export class RateCardUpdate extends RateCardCreate {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version!: number;
}
export class RateCardDelete {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version!: number;
}
export class RateCardQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({ enum: ['VEHICLE', 'BUSINESS'] })
  @ValidateIf(optional)
  @IsIn(['VEHICLE', 'BUSINESS'])
  scope?: 'VEHICLE' | 'BUSINESS';
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
export class QuotePreviewInput {
  @ApiProperty({ format: 'uuid' }) @IsUUID() vehicleId!: string;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(offsetDate)
  startAt!: string;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(offsetDate)
  endAt!: string;
  @ApiPropertyOptional({
    enum: BILLING_MODES,
    description: 'Defaults to daily when available, otherwise hourly.',
  })
  @ValidateIf(optional)
  @IsIn(BILLING_MODES)
  billingMode?: 'HOURLY' | 'DAILY';
  @ApiProperty({ enum: ['Asia/Ho_Chi_Minh'] })
  @IsIn(['Asia/Ho_Chi_Minh'])
  timeZone!: 'Asia/Ho_Chi_Minh';
}
export class RentalPricingSelection {
  @ApiPropertyOptional({ enum: BILLING_MODES })
  @ValidateIf(optional)
  @IsIn(BILLING_MODES)
  billingMode?: 'HOURLY' | 'DAILY';
  @ApiPropertyOptional({
    pattern: '^[a-f0-9]{64}$',
    description:
      'Required for a calculated or overridden available quotation; current rate/schedule must match.',
  })
  @ValidateIf(optional)
  @Matches(/^[a-f0-9]{64}$/)
  expectedQuoteHash?: string;
  @ApiPropertyOptional({
    pattern: '^(0|[1-9][0-9]{0,8})$',
    description: 'Explicit agreed whole-VND amount; requires a reason.',
  })
  @ValidateIf(optional)
  @Matches(/^(0|[1-9][0-9]{0,8})$/)
  overrideAmount?: string;
  @ApiPropertyOptional({
    description: 'Required for a manual agreement or override.',
  })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  @Matches(/\S/)
  overrideReason?: string;
}
