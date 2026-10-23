import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, ValidateIf } from 'class-validator';
import { PageQuery } from '../core/dto.js';
import { PageMeta } from '../core/responses.js';
export class PlatformBusinessQuery extends PageQuery {
  @ApiPropertyOptional({ maxLength: 120 })
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(0, 120)
  search?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: string;
  @ApiPropertyOptional({ enum: ['name', 'createdAt'], default: 'createdAt' })
  @IsIn(['name', 'createdAt'])
  sort: 'name' | 'createdAt' = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
export class PlatformPrincipal {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['PLATFORM_OPERATOR'] }) role!: string;
}
export class PlatformMe {
  @ApiProperty({ type: PlatformPrincipal }) principal!: PlatformPrincipal;
  @ApiProperty({ type: [String] }) permissions!: readonly string[];
  @ApiProperty({ enum: [true] }) readOnly!: true;
}
export class PlatformCounts {
  @ApiProperty() branches!: number;
  @ApiProperty() activeBranches!: number;
  @ApiProperty({
    description: 'Tenant membership rows, not unique people across businesses.',
  })
  memberships!: number;
  @ApiProperty({
    description:
      'ACTIVE membership rows whose profile is ACTIVE; includes disabled businesses.',
  })
  activeMemberships!: number;
  @ApiProperty() vehicles!: number;
  @ApiProperty() activeVehicles!: number;
  @ApiProperty() rentals!: number;
  @ApiProperty({ description: 'ACTIVE rental status, including overdue.' })
  activeRentals!: number;
  @ApiProperty() reservedRentals!: number;
}
export class PlatformGpsHealth {
  @ApiProperty({ enum: ['TEST'] }) sourceMode!: 'TEST';
  @ApiProperty() FRESH!: number;
  @ApiProperty() STALE!: number;
  @ApiProperty() OFFLINE!: number;
  @ApiProperty() NO_DATA!: number;
  @ApiProperty() UNASSIGNED!: number;
}
export class PlatformBusiness {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: PlatformCounts }) counts!: PlatformCounts;
  @ApiProperty({ type: PlatformGpsHealth }) gps!: PlatformGpsHealth;
}
export class PlatformBusinessPage extends PageMeta {
  @ApiProperty({ type: [PlatformBusiness] }) data!: PlatformBusiness[];
}
export class PlatformBusinessStats {
  @ApiProperty() total!: number;
  @ApiProperty() ACTIVE!: number;
  @ApiProperty() DISABLED!: number;
}
export class PlatformOverview {
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty({ type: PlatformBusinessStats })
  businesses!: PlatformBusinessStats;
  @ApiProperty({
    type: PlatformCounts,
    description: 'Counts across all businesses, including disabled ones.',
  })
  totals!: PlatformCounts;
  @ApiProperty({ type: PlatformGpsHealth }) gps!: PlatformGpsHealth;
}
