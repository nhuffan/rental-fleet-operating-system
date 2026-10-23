import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Length, ValidateIf } from 'class-validator';
import { PageQuery } from '../../core/dto.js';
import { PageMeta } from '../../core/responses.js';
export class LocationQuery extends PageQuery {
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(0, 80)
  search?: string;
  @ApiPropertyOptional({
    enum: ['FRESH', 'STALE', 'OFFLINE', 'NO_DATA', 'UNASSIGNED'],
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['FRESH', 'STALE', 'OFFLINE', 'NO_DATA', 'UNASSIGNED'])
  state?: string;
}
export class PositionResponse {
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty({ description: 'Kilometers per hour' }) speedKph!: number;
  @ApiProperty() heading!: number;
  @ApiProperty({ type: Boolean, nullable: true }) ignition!: boolean | null;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty({ enum: ['TEST'] }) sourceMode!: string;
}
export class LocationResponse {
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty() licensePlate!: string;
  @ApiProperty() make!: string;
  @ApiProperty() model!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) deviceId!:
    string | null;
  @ApiProperty({ enum: ['FRESH', 'STALE', 'OFFLINE', 'NO_DATA', 'UNASSIGNED'] })
  state!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  lastSeenAt!: string | null;
  @ApiProperty({ type: PositionResponse, nullable: true })
  location!: PositionResponse | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  currentRentalId!: string | null;
}
export class LocationStats {
  @ApiProperty() FRESH!: number;
  @ApiProperty() STALE!: number;
  @ApiProperty() OFFLINE!: number;
  @ApiProperty() NO_DATA!: number;
  @ApiProperty() UNASSIGNED!: number;
}
export class LocationPage extends PageMeta {
  @ApiProperty({ type: [LocationResponse] }) data!: LocationResponse[];
  @ApiProperty({ type: LocationStats }) stats!: LocationStats;
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty() pollAfterSeconds!: number;
}
export class IngestionResponse {
  @ApiProperty() duplicate!: boolean;
  @ApiProperty({ format: 'uuid' }) positionId!: string;
}

export class IngressLimitsResponse {
  @ApiProperty() bodyBytes!: number;
  @ApiProperty() windowSeconds!: number;
  @ApiProperty() globalRequests!: number;
  @ApiProperty() deviceRequests!: number;
  @ApiProperty() concurrentRequests!: number;
  @ApiProperty() trackedDevices!: number;
}
export class RecentIngestionResponse {
  @ApiProperty() windowSeconds!: number;
  @ApiProperty({
    description:
      'Persisted unique fixes received in the last 15 minutes, excluding retransmissions.',
  })
  positions!: number;
  @ApiProperty() devices!: number;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  lastReceivedAt!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: 'Latest recorded fix among positions received in this window.',
  })
  lastRecordedAt!: string | null;
}
export class TelemetryDiagnosticsResponse {
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty({ enum: ['TEST'] }) sourceMode!: 'TEST';
  @ApiProperty() ingestionEnabled!: boolean;
  @ApiProperty({ type: RecentIngestionResponse })
  recent!: RecentIngestionResponse;
  @ApiProperty({ type: LocationStats }) freshness!: LocationStats;
  @ApiProperty({ type: IngressLimitsResponse }) limits!: IngressLimitsResponse;
  @ApiProperty({
    enum: ['PROCESS_LOCAL'],
    description:
      'Limits apply independently to each API process and reset on restart.',
  })
  limiterScope!: 'PROCESS_LOCAL';
  @ApiProperty({
    enum: ['INTERNAL_AGGREGATE_LOGS'],
    description:
      'Failure counts are process-wide, redacted and never exposed across tenant boundaries.',
  })
  failureReporting!: 'INTERNAL_AGGREGATE_LOGS';
}
