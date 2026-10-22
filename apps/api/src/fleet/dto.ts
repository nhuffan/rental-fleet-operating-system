import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PageQuery } from '../core/dto.js';

const optional = (_o: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export const normalizePlate = (value: unknown) =>
  typeof value === 'string'
    ? value.toUpperCase().replace(/[\s.-]/g, '')
    : value;
export const normalizeProvider = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
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
