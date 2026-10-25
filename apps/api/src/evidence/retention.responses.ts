import { ApiProperty } from '@nestjs/swagger';
export class EvidenceRetentionSettingsResponse {
  @ApiProperty({ enum: [30, 90] }) retentionDays!: 30 | 90;
  @ApiProperty({
    description:
      'False by default. Physical deletion requires an explicit development-only server switch.',
  })
  deletionEnabled!: boolean;
}
export class EvidenceStorageTotal {
  @ApiProperty() count!: number;
  @ApiProperty() bytes!: number;
}
export class EvidenceStorageLimits {
  @ApiProperty() maxTenantBytes!: number;
}
export class EvidenceStorageUsageResponse extends EvidenceRetentionSettingsResponse {
  @ApiProperty({ type: EvidenceStorageLimits }) limits!: EvidenceStorageLimits;
  @ApiProperty({
    description:
      'Quota reservations including temporary pending copies; not a project-wide Storage bill.',
  })
  totalReservedBytes!: number;
  @ApiProperty({ type: EvidenceStorageTotal }) active!: EvidenceStorageTotal;
  @ApiProperty({
    type: EvidenceStorageTotal,
    description:
      'Unattached upload reservations: bytes are reserved worst-case capacity.',
  })
  pending!: EvidenceStorageTotal;
  @ApiProperty({ type: EvidenceStorageTotal }) retained!: EvidenceStorageTotal;
  @ApiProperty({ type: EvidenceStorageTotal }) held!: EvidenceStorageTotal;
  @ApiProperty({
    type: EvidenceStorageTotal,
    description: 'Immutable removed-media metadata, showing original bytes.',
  })
  purged!: EvidenceStorageTotal;
}
export class EvidenceRentalHoldResponse {
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty() unresolvedDispute!: boolean;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) actorId!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  changedAt!: string | null;
}
export class EvidenceImportantResponse {
  @ApiProperty({ format: 'uuid' }) evidenceId!: string;
  @ApiProperty() important!: boolean;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'uuid' }) actorId!: string;
  @ApiProperty({ format: 'date-time' }) changedAt!: string;
}
