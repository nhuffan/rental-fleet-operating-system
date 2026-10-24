import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
export const EVIDENCE_TYPES = ['HANDOVER', 'RETURN'] as const;
export const EVIDENCE_KINDS = ['IMAGE', 'VIDEO'] as const;
export const EVIDENCE_CATEGORIES = [
  'FRONT',
  'REAR',
  'LEFT',
  'RIGHT',
  'INTERIOR',
  'DASHBOARD',
  'DAMAGE',
  'OTHER',
] as const;
export const EVIDENCE_MIMES = [
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
] as const;
export class EvidenceUploadCreate {
  @ApiProperty({ format: 'uuid' }) @IsUUID() idempotencyKey!: string;
  @ApiProperty({ enum: EVIDENCE_TYPES })
  @IsIn(EVIDENCE_TYPES)
  type!: (typeof EVIDENCE_TYPES)[number];
  @ApiProperty({ enum: EVIDENCE_KINDS })
  @IsIn(EVIDENCE_KINDS)
  kind!: (typeof EVIDENCE_KINDS)[number];
  @ApiProperty({ enum: EVIDENCE_CATEGORIES })
  @IsIn(EVIDENCE_CATEGORIES)
  category!: (typeof EVIDENCE_CATEGORIES)[number];
  @ApiProperty({ enum: EVIDENCE_MIMES })
  @IsIn(EVIDENCE_MIMES)
  mimeType!: (typeof EVIDENCE_MIMES)[number];
  @ApiProperty({ minimum: 1, maximum: 12582912 })
  @IsInt()
  @Min(1)
  @Max(12582912)
  bytes!: number;
}
