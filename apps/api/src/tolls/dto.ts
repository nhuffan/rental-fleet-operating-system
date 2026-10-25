import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../core/dto.js';
export const TOLL_STATUSES = [
  'UNMATCHED',
  'NEEDS_REVIEW',
  'MATCHED',
  'RECORDED',
  'IGNORED',
] as const;
const optional = (_o: unknown, value: unknown) => value !== undefined;
const nullable = (_o: unknown, value: unknown) => value !== null;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class TollColumnMapping {
  @ApiProperty() @IsInt() @Min(0) @Max(31) plate!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(31) occurredAt!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(31) amount!: number;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @IsInt()
  @Min(0)
  @Max(31)
  station?: number;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @IsInt()
  @Min(0)
  @Max(31)
  description?: number;
  @ApiPropertyOptional()
  @ValidateIf(optional)
  @IsInt()
  @Min(0)
  @Max(31)
  externalReference?: number;
}
export class TollImportPreview {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) source!: string;
  @ApiProperty({ maxLength: 65536 }) @IsString() @Length(1, 65536) csv!: string;
  @ApiProperty({ enum: [',', ';', '\t'] })
  @IsIn([',', ';', '\t'])
  delimiter!: string;
  @ApiProperty({ type: TollColumnMapping })
  @IsObject()
  @ValidateNested()
  @Type(() => TollColumnMapping)
  mapping!: TollColumnMapping;
  @ApiProperty({ enum: ['ISO_OFFSET', 'ISO_LOCAL', 'DMY_LOCAL'] })
  @IsIn(['ISO_OFFSET', 'ISO_LOCAL', 'DMY_LOCAL'])
  dateFormat!: string;
  @ApiProperty({ type: String, default: '+07:00' })
  @Matches(/^[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$/)
  timezoneOffset: string = '+07:00';
  @ApiProperty({ enum: ['INTEGER', 'DOT_GROUPED', 'COMMA_GROUPED'] })
  @IsIn(['INTEGER', 'DOT_GROUPED', 'COMMA_GROUPED'])
  amountFormat!: string;
}
export class TollImportConfirm extends TollImportPreview {
  @ApiProperty({ format: 'uuid' }) @IsUUID() idempotencyKey!: string;
  @ApiProperty() @Matches(/^[a-f0-9]{64}$/) previewHash!: string;
  @ApiProperty({ type: [Number], maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(2, { each: true })
  @Max(201, { each: true })
  rowNumbers!: number[];
}
export class TollQuery extends PageQuery {
  @ApiPropertyOptional({ enum: TOLL_STATUSES })
  @ValidateIf(optional)
  @IsIn(TOLL_STATUSES)
  status?: (typeof TOLL_STATUSES)[number];
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(optional)
  @IsUUID()
  rentalId?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  from?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  until?: string;
}
export class TollReview {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @ValidateIf(nullable)
  @IsUUID()
  vehicleId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @ValidateIf(nullable)
  @IsUUID()
  rentalId!: string | null;
  @ApiProperty() @IsBoolean() ignore!: boolean;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  @Matches(/\S/)
  reason!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483646) version!: number;
}
export class TollRecord {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  @Matches(/\S/)
  reason!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483646) version!: number;
  @ApiProperty() @IsBoolean() acknowledgePossibleDuplicate!: boolean;
}
export class TollBulkItem {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483646) version!: number;
}
export class TollBulkRecord {
  @ApiProperty({ type: [TollBulkItem], maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((item: TollBulkItem) => item.id)
  @ValidateNested({ each: true })
  @Type(() => TollBulkItem)
  items!: TollBulkItem[];
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  @Matches(/\S/)
  reason!: string;
}
