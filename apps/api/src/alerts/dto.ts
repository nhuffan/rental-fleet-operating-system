import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, ValidateIf } from 'class-validator';
import { PageQuery } from '../core/dto.js';
import { PageMeta } from '../core/responses.js';
export const ALERT_KINDS = [
  'RENTAL_OVERDUE',
  'RENTAL_DUE_SOON',
  'GPS_STALE',
] as const;
export const ALERT_SEVERITIES = ['CRITICAL', 'WARNING'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export class AlertQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ALERT_KINDS })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(ALERT_KINDS)
  kind?: AlertKind;
  @ApiPropertyOptional({ enum: ALERT_SEVERITIES })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(ALERT_SEVERITIES)
  severity?: AlertSeverity;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  rentalId?: string;
}
export class AlertResponse {
  @ApiProperty({
    description:
      'Stable derived identity; not a persisted event or authorization credential.',
  })
  id!: string;
  @ApiProperty({ enum: ALERT_KINDS }) kind!: AlertKind;
  @ApiProperty({ enum: ALERT_SEVERITIES }) severity!: AlertSeverity;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty() licensePlate!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) rentalId!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) dueAt!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSeenAt!: string | null;
  @ApiProperty({ enum: ['STALE', 'OFFLINE'], nullable: true }) gpsState!:
    'STALE' | 'OFFLINE' | null;
  @ApiProperty({ enum: ['TEST'], nullable: true }) sourceMode!: 'TEST' | null;
  @ApiProperty({
    minimum: 0,
    description:
      'Elapsed seconds since dueAt or lastSeenAt. Zero for returns that are not yet due; use dueAt and asOf for remaining time.',
  })
  ageSeconds!: number;
}
export class AlertStatsResponse {
  @ApiProperty() total!: number;
  @ApiProperty() critical!: number;
  @ApiProperty() warning!: number;
  @ApiProperty() rentalOverdue!: number;
  @ApiProperty() rentalDueSoon!: number;
  @ApiProperty() gpsStale!: number;
}
export class AlertRulesResponse {
  @ApiProperty({ enum: [86400] }) dueSoonSeconds!: number;
  @ApiProperty({ enum: [120] }) gpsStaleAfterSeconds!: number;
  @ApiProperty({ enum: [600] }) gpsOfflineAfterSeconds!: number;
}
export class AlertPageResponse extends PageMeta {
  @ApiProperty({ type: [AlertResponse] }) data!: AlertResponse[];
  @ApiProperty({
    format: 'date-time',
    description: 'Database time shared by calculations, counts and page rows.',
  })
  asOf!: string;
  @ApiProperty({
    type: AlertStatsResponse,
    description:
      'Counts respect vehicle/rental filters, before kind/severity filters.',
  })
  stats!: AlertStatsResponse;
  @ApiProperty({ type: AlertRulesResponse }) rules!: AlertRulesResponse;
  @ApiProperty({ enum: [60] }) pollAfterSeconds!: number;
}
