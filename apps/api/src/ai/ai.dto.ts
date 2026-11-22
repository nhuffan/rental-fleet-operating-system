import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class AiQueryDto {
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  question!: string;
}

export class AiFact {
  @ApiProperty() label!: string;
  @ApiProperty() value!: string;
}
export class AiSource {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ description: 'In-app path built by the server.' })
  path!: string;
}
export class AiToolUse {
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'uuid' }) traceId!: string;
  @ApiProperty({ enum: ['OK', 'ERROR'] }) status!: 'OK' | 'ERROR';
}
export class AiDiagnostics {
  @ApiProperty() provider!: string;
  @ApiProperty() latencyMs!: number;
  @ApiProperty() toolCalls!: number;
}
export class AiAnswerResponse {
  @ApiProperty({ enum: ['ANSWERED', 'CLARIFICATION_NEEDED', 'NO_DATA'] })
  status!: 'ANSWERED' | 'CLARIFICATION_NEEDED' | 'NO_DATA';
  @ApiProperty() answer!: string;
  @ApiProperty({ type: [AiFact] }) facts!: AiFact[];
  @ApiProperty({ type: [AiSource] }) sourceReferences!: AiSource[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  asOf!: string | null;
  @ApiProperty({ type: [String] }) limitations!: string[];
  @ApiProperty({ type: [AiToolUse] }) toolsUsed!: AiToolUse[];
  @ApiProperty({ type: AiDiagnostics }) diagnostics!: AiDiagnostics;
}
