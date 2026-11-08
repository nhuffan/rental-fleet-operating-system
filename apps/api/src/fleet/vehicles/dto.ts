import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PageQuery } from '../../core/dto.js';

const optional = (_o: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export const normalizePlate = (value: unknown) =>
  typeof value === 'string'
    ? value.toUpperCase().replace(/[\s.-]/g, '')
    : value;
export const normalizeProvider = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
// Calendar dates (no time), years 2000–2099 to match the database checks. null clears.
const nullableDate = () =>
  applyDecorators(
    ApiPropertyOptional({
      type: String,
      format: 'date',
      nullable: true,
      example: '2027-03-31',
    }),
    ValidateIf((_o, value) => value !== undefined && value !== null),
    IsISO8601({ strict: true, strictSeparator: true }),
    Matches(/^20\d{2}-\d{2}-\d{2}$/),
  );
const nullableOdometer = () =>
  applyDecorators(
    ApiPropertyOptional({ type: Number, nullable: true, minimum: 0 }),
    ValidateIf((_o, value) => value !== undefined && value !== null),
    Type(() => Number),
    IsInt(),
    Min(0),
    Max(2147483647),
  );
const plate = ({ value }: { value: unknown }) => normalizePlate(value);
const provider = ({ value }: { value: unknown }) => normalizeProvider(value);
const booleanQuery = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class VehicleCreate {
  @ApiProperty({ example: '51A12345', pattern: '^[A-Z0-9]{4,16}$' })
  @Transform(plate)
  @Matches(/^[A-Z0-9]{4,16}$/)
  licensePlate!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) make!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) model!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @ValidateIf((_o, value) => value !== undefined && value !== null)
  @IsUUID()
  branchId?: string | null;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
  @nullableDate() registrationExpiresOn?: string | null;
  @nullableDate() insuranceExpiresOn?: string | null;
  @nullableDate() nextMaintenanceOn?: string | null;
  @nullableOdometer() nextMaintenanceOdometer?: number | null;
}
export class VehicleUpdate {
  @ApiPropertyOptional({ pattern: '^[A-Z0-9]{4,16}$' })
  @ValidateIf(optional)
  @Transform(plate)
  @Matches(/^[A-Z0-9]{4,16}$/)
  licensePlate?: string;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  make?: string;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  model?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @ValidateIf((_o, value) => value !== undefined && value !== null)
  @IsUUID()
  branchId?: string | null;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
  @nullableDate() registrationExpiresOn?: string | null;
  @nullableDate() insuranceExpiresOn?: string | null;
  @nullableDate() nextMaintenanceOn?: string | null;
  @nullableOdometer() nextMaintenanceOdometer?: number | null;
}
export class VehicleQuery extends PageQuery {
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
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  branchId?: string;
  @ApiPropertyOptional({
    enum: ['createdAt', 'licensePlate', 'make', 'model'],
    default: 'createdAt',
  })
  @IsIn(['createdAt', 'licensePlate', 'make', 'model'])
  sort: 'createdAt' | 'licensePlate' | 'make' | 'model' = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
export class GpsDeviceCreate {
  @ApiProperty({ example: 'manual', pattern: '^[a-z0-9][a-z0-9_-]{0,39}$' })
  @Transform(provider)
  @Matches(/^[a-z0-9][a-z0-9_-]{0,39}$/)
  provider!: string;
  @ApiProperty({ pattern: '^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$' })
  @Transform(trim)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/)
  deviceUid!: string;
  @ApiPropertyOptional({ default: '' })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  label?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
export class GpsDeviceUpdate {
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  label?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
export class GpsDeviceQuery extends PageQuery {
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 128)
  search?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @ValidateIf(optional)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @Transform(provider)
  @Matches(/^[a-z0-9][a-z0-9_-]{0,39}$/)
  provider?: string;
  @ApiPropertyOptional({
    type: Boolean,
    description: 'When true, only devices without an active assignment.',
  })
  @ValidateIf(optional)
  @Transform(booleanQuery)
  @IsBoolean()
  available?: boolean;
  @ApiPropertyOptional({
    enum: ['createdAt', 'provider', 'deviceUid'],
    default: 'createdAt',
  })
  @IsIn(['createdAt', 'provider', 'deviceUid'])
  sort: 'createdAt' | 'provider' | 'deviceUid' = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
export class DeviceAssignmentCreate {
  @ApiProperty({ format: 'uuid' }) @IsUUID() deviceId!: string;
}
export const SERVICE_KINDS = ['MAINTENANCE', 'REGISTRATION', 'INSURANCE'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];
export class ServiceRecordCreate {
  @ApiProperty({ enum: SERVICE_KINDS })
  @IsIn(SERVICE_KINDS)
  kind!: ServiceKind;
  @ApiProperty({
    type: String,
    format: 'date',
    description: 'Vietnam calendar date; cannot be in the future.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  performedOn!: string;
  @ApiPropertyOptional({ minimum: 0 })
  @ValidateIf(optional)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  odometer?: number;
  @ApiPropertyOptional({
    type: String,
    pattern: '^(0|[1-9][0-9]{0,14})$',
    description: 'Exact whole VND. Recorded fact only; creates no movement.',
  })
  @ValidateIf(optional)
  @IsString()
  @Matches(/^(0|[1-9][0-9]{0,14})$/)
  costVnd?: string;
  @ApiPropertyOptional({ maxLength: 2000 })
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Length(0, 2000)
  notes?: string;
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description:
      'Updates the matching vehicle date: next maintenance, or the new registration/insurance expiry.',
  })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  nextDueOn?: string;
  @ApiPropertyOptional({
    minimum: 0,
    description: 'MAINTENANCE only: next maintenance odometer.',
  })
  @ValidateIf(optional)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  nextDueOdometer?: number;
}
