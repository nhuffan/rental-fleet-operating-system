import { ApiProperty } from '@nestjs/swagger';
import {
  EVIDENCE_CATEGORIES,
  EVIDENCE_KINDS,
  EVIDENCE_TYPES,
  EVIDENCE_MIMES,
} from './dto.js';
export class EvidenceLimitsResponse {
  @ApiProperty() maxImages!: number;
  @ApiProperty() maxVideos!: number;
  @ApiProperty() maxInspectionBytes!: number;
  @ApiProperty() maxTenantBytes!: number;
  @ApiProperty() maxConcurrentUploads!: number;
  @ApiProperty() maxImageBytes!: number;
  @ApiProperty() maxVideoBytes!: number;
  @ApiProperty() maxVideoSeconds!: number;
}
export class EvidenceUploadResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({
    enum: [
      'PENDING',
      'VERIFYING',
      'VERIFIED',
      'ATTACHED',
      'CANCELLED',
      'REJECTED',
      'PURGED',
    ],
  })
  status!: string;
  @ApiProperty({ enum: EVIDENCE_KINDS }) kind!: (typeof EVIDENCE_KINDS)[number];
  @ApiProperty({ enum: EVIDENCE_CATEGORIES })
  category!: (typeof EVIDENCE_CATEGORIES)[number];
  @ApiProperty({ enum: EVIDENCE_MIMES }) mimeType!: string;
  @ApiProperty() bytes!: number;
  @ApiProperty({ type: Number, nullable: true }) durationSeconds!:
    number | null;
  @ApiProperty({ type: Number, nullable: true }) width!: number | null;
  @ApiProperty({ type: Number, nullable: true }) height!: number | null;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
export class EvidenceUploadAuthorization extends EvidenceUploadResponse {
  @ApiProperty() bucket!: string;
  @ApiProperty() objectKey!: string;
  @ApiProperty() token!: string;
  @ApiProperty() signedUrl!: string;
  @ApiProperty({ type: EvidenceLimitsResponse })
  limits!: EvidenceLimitsResponse;
}
export class EvidenceResponse {
  @ApiProperty({
    enum: ['ACTIVE', 'PURGE_ELIGIBLE', 'PURGING', 'PURGED', 'RETRY_REQUIRED'],
  })
  retentionStatus!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  retentionDeadline!: string | null;
  @ApiProperty() important!: boolean;
  @ApiProperty() legalHold!: boolean;
  @ApiProperty() unresolvedDispute!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  purgedAt!: string | null;
  @ApiProperty() canRead!: boolean;
  @ApiProperty() canProtect!: boolean;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) inspectionId!: string;
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ enum: EVIDENCE_TYPES }) type!: (typeof EVIDENCE_TYPES)[number];
  @ApiProperty({ enum: EVIDENCE_KINDS }) kind!: (typeof EVIDENCE_KINDS)[number];
  @ApiProperty({ enum: EVIDENCE_CATEGORIES })
  category!: (typeof EVIDENCE_CATEGORIES)[number];
  @ApiProperty({ format: 'uuid' }) uploadedBy!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() bytes!: number;
  @ApiProperty({ type: Number, nullable: true }) durationSeconds!:
    number | null;
  @ApiProperty() width!: number;
  @ApiProperty() height!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class RentalEvidenceResponse {
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty({ type: [EvidenceResponse], maxItems: 18 })
  data!: EvidenceResponse[];
}
export class EvidenceReadAuthorization {
  @ApiProperty() url!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
