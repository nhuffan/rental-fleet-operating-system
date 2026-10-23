import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsString,
  IsUUID,
  IsISO8601,
  Matches,
  Length,
  ValidateIf,
} from 'class-validator';
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

export const PLATFORM_AUDIT_ACTIONS = [
  'platform.me.read',
  'platform.overview.read',
  'platform.businesses.read',
  'platform.business.read',
  'platform.audit.read',
  'platform.users.read',
  'platform.user.read',
  'platform_membership.create',
  'other',
] as const;
export class PlatformAuditQuery extends PageQuery {
  @ApiPropertyOptional({ enum: PLATFORM_AUDIT_ACTIONS })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(PLATFORM_AUDIT_ACTIONS)
  action?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  businessId?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Inclusive; UTC offset required. Defaults to 30 days before until. Range at most 366 days.',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  from?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Exclusive; defaults to current time.',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  until?: string;
  @ApiPropertyOptional({ enum: ['createdAt', 'action'], default: 'createdAt' })
  @IsIn(['createdAt', 'action'])
  sort: 'createdAt' | 'action' = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
export class PlatformAuditEntry {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) actorId!: string;
  @ApiProperty({ enum: PLATFORM_AUDIT_ACTIONS }) action!: string;
  @ApiProperty({
    enum: ['platform', 'business', 'user', 'platform_membership', 'other'],
  })
  entityType!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) entityId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) requestId!:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class PlatformAuditPage extends PageMeta {
  @ApiProperty({ type: [PlatformAuditEntry] }) data!: PlatformAuditEntry[];
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) until!: string;
}
export class PlatformUserQuery extends PlatformBusinessQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  businessId?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['ACTIVE', 'DISABLED'])
  membershipStatus?: string;
}
export class PlatformUser {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED', 'NONE'] })
  platformStatus!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty() membershipCount!: number;
  @ApiProperty({
    description: 'Membership, business and profile must all be ACTIVE.',
  })
  activeMembershipCount!: number;
  @ApiProperty({ type: [String] }) roles!: string[];
}
export class PlatformUserPage extends PageMeta {
  @ApiProperty({
    type: [PlatformUser],
    description: 'One row per unique profile, never one row per membership.',
  })
  data!: PlatformUser[];
}
export class PlatformUserMembership {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty() businessName!: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) businessStatus!: string;
  @ApiProperty({ enum: ['OWNER'] }) roleKey!: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status!: string;
}
export class PlatformUserMembershipPage extends PageMeta {
  @ApiProperty({ type: [PlatformUserMembership] })
  data!: PlatformUserMembership[];
}
export class PlatformUserDetail {
  @ApiProperty({ type: PlatformUser }) profile!: PlatformUser;
  @ApiProperty({ type: PlatformUserMembershipPage })
  memberships!: PlatformUserMembershipPage;
}
