import { ApiProperty } from '@nestjs/swagger';
import { PageMeta } from '../core/responses.js';
import { TOLL_STATUSES } from './dto.js';
export class TollSuggestion {
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) vehicleId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) vehiclePlate!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) rentalId!:
    string | null;
  @ApiProperty({ type: [String] }) rentalCandidates!: string[];
  @ApiProperty() ambiguous!: boolean;
}
export class TollNormalizedResponse {
  @ApiProperty() source!: string;
  @ApiProperty() plate!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() station!: string;
  @ApiProperty() description!: string;
  @ApiProperty() externalReference!: string;
  @ApiProperty() fingerprint!: string;
}
export class TollPreviewRow {
  @ApiProperty() rowNumber!: number;
  @ApiProperty({ enum: ['VALID', 'INVALID', 'DUPLICATE', 'CONFLICT'] })
  status!: string;
  @ApiProperty({ type: [String] }) errors!: string[];
  @ApiProperty({ type: TollNormalizedResponse, nullable: true })
  normalized!: TollNormalizedResponse | null;
  @ApiProperty({ type: String, nullable: true }) duplicateOf!: string | null;
  @ApiProperty({ type: TollSuggestion }) suggestion!: TollSuggestion;
  @ApiProperty({ type: [String] }) possibleDuplicateMovementIds!: string[];
}
export class TollPreviewSummary {
  @ApiProperty() total!: number;
  @ApiProperty() valid!: number;
  @ApiProperty() invalid!: number;
  @ApiProperty() duplicate!: number;
  @ApiProperty() conflict!: number;
}
export class TollPreviewResponse {
  @ApiProperty() source!: string;
  @ApiProperty() previewHash!: string;
  @ApiProperty({ type: [TollPreviewRow] }) rows!: TollPreviewRow[];
  @ApiProperty({ type: TollPreviewSummary }) summary!: TollPreviewSummary;
}
export class TollImportResponse {
  @ApiProperty({ format: 'uuid' }) batchId!: string;
  @ApiProperty() importedCount!: number;
  @ApiProperty() duplicateCount!: number;
  @ApiProperty() idempotent!: boolean;
}
export class TollResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) batchId!: string;
  @ApiProperty() source!: string;
  @ApiProperty() externalReference!: string;
  @ApiProperty() plate!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() station!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: TOLL_STATUSES }) status!: (typeof TOLL_STATUSES)[number];
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) vehicleId!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) rentalId!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) movementId!:
    string | null;
  @ApiProperty() reviewReason!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: TollSuggestion }) suggestion!: TollSuggestion;
  @ApiProperty({ type: [String] }) possibleDuplicateMovementIds!: string[];
  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['POSTED', 'REVERSED', 'REVERSAL'],
  })
  movementStatus!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) reversedBy!:
    string | null;
}
export class TollPage extends PageMeta {
  @ApiProperty({ type: [TollResponse] }) data!: TollResponse[];
}
export class TollReviewEvent {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['IMPORTED', 'MATCH_CONFIRMED', 'IGNORED', 'RECORDED'] })
  action!: string;
  @ApiProperty({ format: 'uuid' }) actorId!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) vehicleId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) rentalId!:
    string | null;
  @ApiProperty({ enum: TOLL_STATUSES }) status!: (typeof TOLL_STATUSES)[number];
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class TollDetailResponse extends TollResponse {
  @ApiProperty({ type: [TollReviewEvent] }) history!: TollReviewEvent[];
}
export class TollBulkResponse {
  @ApiProperty({ type: [TollResponse] }) data!: TollResponse[];
}
