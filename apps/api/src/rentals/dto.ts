import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsObject,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { PageQuery } from '../core/dto.js';
const optional = (_o: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const bool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
export const RENTAL_STATUSES = [
  'DRAFT',
  'RESERVED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
] as const;
export const MAX_RENTAL_AMOUNT = 999999999.99;
const timezoneDate = /T.*(?:Z|[+-]\d{2}:\d{2})$/;
export class CustomerCreate {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @ApiPropertyOptional({
    default: '',
    description: 'At least one of phone or email is required.',
  })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 32)
  @Matches(/^(?:\+?[0-9][0-9 -]{4,31})?$/)
  phone?: string;
  @ApiPropertyOptional({ default: '' })
  @ValidateIf(optional)
  @Transform(email)
  @IsString()
  @Length(0, 254)
  @Matches(/^(?:[^\s@]+@[^\s@]+\.[^\s@]+)?$/)
  email?: string;
  @ApiPropertyOptional({ default: '' })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 2000)
  notes?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
export class CustomerUpdate {
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name?: string;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 32)
  @Matches(/^(?:\+?[0-9][0-9 -]{4,31})?$/)
  phone?: string;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(email)
  @IsString()
  @Length(0, 254)
  @Matches(/^(?:[^\s@]+@[^\s@]+\.[^\s@]+)?$/)
  email?: string;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 2000)
  notes?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
export class CustomerQuery extends PageQuery {
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  search?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
  @ApiPropertyOptional({ enum: ['createdAt', 'name'], default: 'createdAt' })
  @IsIn(['createdAt', 'name'])
  sort: 'createdAt' | 'name' = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
export class RentalCreate {
  @ApiProperty({ format: 'uuid' }) @IsUUID() customerId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() vehicleId!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'ISO date-time with explicit UTC offset.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  startAt!: string;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  endAt!: string;
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_RENTAL_AMOUNT, default: 0 })
  @ValidateIf(optional)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  rentalAmount?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_RENTAL_AMOUNT, default: 0 })
  @ValidateIf(optional)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  depositRequiredAmount?: number;
  @ApiPropertyOptional({ default: false })
  @ValidateIf(optional)
  @IsBoolean()
  depositReceived?: boolean;
  @ApiPropertyOptional({ default: '' })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 4000)
  notes?: string;
}
export class RentalUpdate {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  customerId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  startAt?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  endAt?: string;
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_RENTAL_AMOUNT })
  @ValidateIf(optional)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  rentalAmount?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_RENTAL_AMOUNT })
  @ValidateIf(optional)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  depositRequiredAmount?: number;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @IsBoolean()
  depositReceived?: boolean;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 4000)
  notes?: string;
}
export class RentalQuery extends PageQuery {
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  search?: string;
  @ApiPropertyOptional({ enum: RENTAL_STATUSES })
  @ValidateIf(optional)
  @IsIn(RENTAL_STATUSES)
  status?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  customerId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf(optional)
  @Transform(bool)
  @IsBoolean()
  overdue?: boolean;
  @ApiPropertyOptional({
    enum: ['createdAt', 'startAt', 'endAt'],
    default: 'createdAt',
  })
  @IsIn(['createdAt', 'startAt', 'endAt'])
  sort: 'createdAt' | 'startAt' | 'endAt' = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
export class VehicleAvailabilityQuery extends PageQuery {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  startAt!: string;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  endAt!: string;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  search?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  branchId?: string;
  @ApiPropertyOptional({ type: Boolean, default: false })
  @ValidateIf(optional)
  @Transform(bool)
  @IsBoolean()
  availableOnly?: boolean;
}
export const INSPECTION_CONDITIONS = ['GOOD', 'DAMAGED'] as const;
export const INSPECTION_CHECK_STATES = [
  'PRESENT',
  'MISSING',
  'NOT_APPLICABLE',
] as const;
export type InspectionCondition = (typeof INSPECTION_CONDITIONS)[number];
export type InspectionCheckState = (typeof INSPECTION_CHECK_STATES)[number];
const hasDamage = (value: {
  exteriorCondition?: unknown;
  interiorCondition?: unknown;
}) =>
  value.exteriorCondition === 'DAMAGED' ||
  value.interiorCondition === 'DAMAGED';
@ValidatorConstraint({ name: 'damageNotesRequired', async: false })
class DamageNotesRequired implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    return (
      !hasDamage(
        args.object as {
          exteriorCondition?: unknown;
          interiorCondition?: unknown;
        },
      ) ||
      (typeof value === 'string' && value.trim().length > 0)
    );
  }
  defaultMessage() {
    return 'Describe the damage when exterior or interior condition is DAMAGED';
  }
}
export class RentalInspectionInput {
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: 'Fuel level as an integer percentage, 0 through 100.',
  })
  @IsInt()
  @Min(0)
  @Max(100)
  fuelPercent!: number;
  @ApiProperty({ enum: INSPECTION_CONDITIONS })
  @IsIn(INSPECTION_CONDITIONS)
  exteriorCondition!: InspectionCondition;
  @ApiProperty({ enum: INSPECTION_CONDITIONS })
  @IsIn(INSPECTION_CONDITIONS)
  interiorCondition!: InspectionCondition;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES })
  @IsIn(INSPECTION_CHECK_STATES)
  spareTire!: InspectionCheckState;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES })
  @IsIn(INSPECTION_CHECK_STATES)
  tools!: InspectionCheckState;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES })
  @IsIn(INSPECTION_CHECK_STATES)
  registrationDocument!: InspectionCheckState;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES })
  @IsIn(INSPECTION_CHECK_STATES)
  insuranceDocument!: InspectionCheckState;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES })
  @IsIn(INSPECTION_CHECK_STATES)
  keys!: InspectionCheckState;
  @ApiPropertyOptional({
    maxLength: 2000,
    default: '',
    description:
      'Required and nonblank when exteriorCondition or interiorCondition is DAMAGED.',
  })
  @ValidateIf(
    (inspection: RentalInspectionInput, value: unknown) =>
      value !== undefined || hasDamage(inspection),
  )
  @Transform(trim)
  @IsString()
  @Length(0, 2000)
  @Validate(DamageNotesRequired)
  damageNotes?: string;
  @ApiPropertyOptional({ maxLength: 2000, default: '' })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 2000)
  notes?: string;
}
export class RentalHandover {
  @ApiProperty({ minimum: 0, maximum: 2147483647 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  odometerStart!: number;
  @ApiProperty({ type: RentalInspectionInput })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RentalInspectionInput)
  inspection!: RentalInspectionInput;
}
export class RentalReturn {
  @ApiProperty({ minimum: 0, maximum: 2147483647 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  odometerEnd!: number;
  @ApiProperty({ type: RentalInspectionInput })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RentalInspectionInput)
  inspection!: RentalInspectionInput;
}
export class RentalExtend {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  endAt!: string;
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_RENTAL_AMOUNT })
  @ValidateIf(optional)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  rentalAmount?: number;
}
export class RentalCancel {
  @ApiPropertyOptional({
    description:
      'Optional replacement notes, recorded on the rental rather than audit metadata.',
  })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 4000)
  notes?: string;
}
