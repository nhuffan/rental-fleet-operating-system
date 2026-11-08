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
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
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
  @ApiProperty({ enum: [false] }) readOnly!: false;
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
  'platform.business.create',
  'platform.owner.access_link.issue',
  'platform.business.status.update',
  'platform.me.read',
  'platform.overview.read',
  'platform.businesses.read',
  'platform.business.read',
  'platform.audit.read',
  'platform.users.read',
  'platform.user.read',
  'platform.system.read',
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

const trimPlatform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
@ValidatorConstraint({ name: 'platformTimezone' })
class PlatformTimezone implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (typeof value !== 'string') return false;
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage() {
    return 'timezone must be a valid IANA timezone';
  }
}
export class PlatformBusinessCreate {
  @ApiProperty()
  @Transform(trimPlatform)
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name!: string;
  @ApiPropertyOptional({ default: 'Asia/Ho_Chi_Minh' })
  @Transform(trimPlatform)
  @IsString()
  @Length(1, 80)
  @Validate(PlatformTimezone)
  timezone: string = 'Asia/Ho_Chi_Minh';
  @ApiPropertyOptional({ default: 'VND' })
  @Transform(trimPlatform)
  @Matches(/^[A-Z]{3}$/)
  currency: string = 'VND';
  @ApiPropertyOptional({ default: 'Trụ sở chính' })
  @Transform(trimPlatform)
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  firstBranchName: string = 'Trụ sở chính';
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(3, 254)
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  ownerEmail!: string;
  @ApiProperty()
  @Transform(trimPlatform)
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  ownerDisplayName!: string;
}
export class PlatformOwnerLinkInput {
  @ApiProperty({ format: 'uuid' }) @IsUUID() membershipId!: string;
}
export class PlatformBusinessStatusInput {
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] })
  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}
export class PlatformBusinessRecord {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class PlatformFirstBranch {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}
export class PlatformProvisionedOwner {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() created!: boolean;
}
export class PlatformOwnerLinkResponse {
  @ApiProperty({
    description: 'Credential, shown once. Never persist or log this URL.',
  })
  accessUrl!: string;
}
export class PlatformProvisioningResponse extends PlatformOwnerLinkResponse {
  @ApiProperty({ type: PlatformBusinessRecord })
  business!: PlatformBusinessRecord;
  @ApiProperty({ type: PlatformFirstBranch }) branch!: PlatformFirstBranch;
  @ApiProperty({ type: PlatformProvisionedOwner })
  owner!: PlatformProvisionedOwner;
}
export class PlatformBusinessOwner {
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) profileStatus!: string;
}
export class PlatformBusinessOwners {
  @ApiProperty({ type: [PlatformBusinessOwner] })
  data!: PlatformBusinessOwner[];
  @ApiProperty() total!: number;
}
export class PlatformBusinessDetail extends PlatformBusiness {
  @ApiProperty({ type: PlatformBusinessOwners })
  owners!: PlatformBusinessOwners;
}

export class PlatformSystemDatabase {
  @ApiProperty() reachable!: boolean;
  @ApiProperty({ type: String, nullable: true }) latestMigration!:
    string | null;
  @ApiProperty({ type: Number, nullable: true }) migrationCount!:
    number | null;
}
export class PlatformIntegrationStatus {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({
    enum: ['CONFIGURED', 'NOT_CONFIGURED', 'TEST_ONLY', 'PUBLIC'],
  })
  status!: string;
  @ApiProperty() detail!: string;
}
export class PlatformFeatureStatus {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ['AVAILABLE', 'TEST', 'NOT_IMPLEMENTED'] })
  status!: string;
  @ApiProperty() description!: string;
}
export class PlatformSystemLimits {
  @ApiProperty() gpsRequestsPerMinute!: number;
  @ApiProperty() gpsDeviceRequestsPerMinute!: number;
  @ApiProperty() gpsMaxBodyBytes!: number;
  @ApiProperty() evidenceMaxImages!: number;
  @ApiProperty() evidenceMaxVideos!: number;
  @ApiProperty() evidenceMaxTenantBytes!: number;
  @ApiProperty() reportMaxDays!: number;
  @ApiProperty() reportMaxRows!: number;
}
export class PlatformJobStatus {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ['off', 'dry-run', 'apply'] }) mode!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastRunAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastOutcome!: string | null;
}
export class PlatformJobs {
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ type: [PlatformJobStatus] }) jobs!: PlatformJobStatus[];
}
export class PlatformSystem {
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty({ enum: ['development', 'test', 'staging', 'production'] })
  environment!: string;
  @ApiProperty({ type: PlatformSystemDatabase })
  database!: PlatformSystemDatabase;
  @ApiProperty({ type: [PlatformIntegrationStatus] })
  integrations!: PlatformIntegrationStatus[];
  @ApiProperty({ type: [PlatformFeatureStatus] })
  features!: PlatformFeatureStatus[];
  @ApiProperty({ type: PlatformSystemLimits }) limits!: PlatformSystemLimits;
  @ApiProperty({
    type: PlatformJobs,
    description:
      'In-process background jobs; last-run values are per API process and reset on restart.',
  })
  jobs!: PlatformJobs;
}
