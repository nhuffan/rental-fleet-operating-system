import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class EvidenceRetentionSettingsUpdate {
  @ApiProperty({ enum: [30, 90] }) @IsInt() @IsIn([30, 90]) retentionDays!:
    30 | 90;
}
export class EvidenceImportantUpdate {
  @ApiProperty() @IsBoolean() important!: boolean;
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
export class EvidenceRentalHoldUpdate {
  @ApiProperty() @IsBoolean() active!: boolean;
  @ApiProperty({
    description:
      'Must be explicitly false when releasing the hold; unresolved disputes remain protected.',
  })
  @IsBoolean()
  unresolvedDispute!: boolean;
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
