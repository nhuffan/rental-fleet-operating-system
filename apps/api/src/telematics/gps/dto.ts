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
