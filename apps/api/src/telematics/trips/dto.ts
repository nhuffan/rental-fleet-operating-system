import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PageQuery } from '../../core/dto.js';
import { PageMeta } from '../../core/responses.js';
export class TripQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  vehicleId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  rentalId?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'UTC range start; defaults to 24 hours before to. Maximum range 7 days.',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  from?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Exclusive range end; defaults to now.',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  to?: string;
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  sort: 'asc' | 'desc' = 'desc';
}
export class TripRouteQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 500, minimum: 1, maximum: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 500;
}
export class TripRange {
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) to!: string;
}
export class TripRentalAssociation {
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty({ enum: ['CONTAINED', 'OVERLAP'] }) relation!:
    'CONTAINED' | 'OVERLAP';
  @ApiProperty({
    enum: ['SCHEDULED_WINDOW'],
    description:
      'Temporal overlap with a scheduled rental; does not prove actual customer use.',
  })
  basis!: 'SCHEDULED_WINDOW';
}
export class TripSummary {
  @ApiProperty({
    description:
      'Opaque query-scoped derived identifier, not an authorization credential. Late packets or retention may change segmentation.',
  })
  id!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty() licensePlate!: string;
  @ApiProperty({ format: 'uuid' }) assignmentId!: string;
  @ApiProperty({ format: 'uuid' }) deviceId!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description:
      'Set only for exactly one containing scheduled rental; association remains inferred.',
  })
  rentalId!: string | null;
  @ApiProperty({ type: [TripRentalAssociation] })
  rentalAssociations!: TripRentalAssociation[];
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time' }) endedAt!: string;
  @ApiProperty() durationSeconds!: number;
  @ApiProperty({
    description:
      'Haversine estimate over usable consecutive fixes; never an odometer measurement.',
  })
  distanceMeters!: number;
  @ApiProperty() pointCount!: number;
  @ApiProperty({ enum: ['TEST'] }) sourceMode!: 'TEST';
  @ApiProperty({ enum: ['DERIVED'] }) derivation!: 'DERIVED';
  @ApiProperty({ enum: ['ESTIMATED'] }) distanceKind!: 'ESTIMATED';
  @ApiProperty({ format: 'date-time' }) lastRecordedAt!: string;
  @ApiProperty({ format: 'date-time' }) lastReceivedAt!: string;
  @ApiProperty({ enum: ['FRESH', 'STALE', 'OFFLINE'] }) freshness!:
    'FRESH' | 'STALE' | 'OFFLINE';
  @ApiProperty() partial!: boolean;
  @ApiProperty({ type: [String] }) partialReasons!: string[];
  @ApiProperty() routeAvailable!: boolean;
  @ApiProperty({ type: TripRange }) range!: TripRange;
}
export class TripPage extends PageMeta {
  @ApiProperty({ type: [TripSummary] }) data!: TripSummary[];
  @ApiProperty({ type: TripRange }) range!: TripRange;
  @ApiProperty() retentionDays!: number;
  @ApiProperty({
    format: 'date-time',
    description:
      'Received-time retention cutoff; older retained latest fixes do not imply complete history.',
  })
  retentionBoundaryAt!: string;
  @ApiProperty() candidatePointLimit!: number;
}
export class TripPoint {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty() speedKph!: number;
  @ApiProperty() heading!: number;
  @ApiProperty({ type: Boolean, nullable: true }) ignition!: boolean | null;
  @ApiProperty({ enum: ['TEST'] }) sourceMode!: 'TEST';
  @ApiProperty({
    description:
      'Start a new polyline here; never connect a physically implausible jump.',
  })
  breakBefore!: boolean;
}
export class TripRoutePage extends PageMeta {
  @ApiProperty() tripId!: string;
  @ApiProperty({ type: [TripPoint] }) data!: TripPoint[];
  @ApiProperty() hasMore!: boolean;
  @ApiProperty({ enum: ['ESTIMATED'] }) distanceKind!: 'ESTIMATED';
  @ApiProperty() partial!: boolean;
  @ApiProperty({ type: [String] }) partialReasons!: string[];
}
