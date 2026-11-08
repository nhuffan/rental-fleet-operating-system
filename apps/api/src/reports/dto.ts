import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, Matches, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const REPORT_EXPORTS = [
  'vehicles',
  'customers',
  'rentals',
  'movements',
] as const;
export type ReportExport = (typeof REPORT_EXPORTS)[number];
export const REPORT_MAX_DAYS = 366;
export const REPORT_DEFAULT_DAYS = 30;
export const REPORT_ROW_LIMIT = 10_000;
const optional = (_o: unknown, value: unknown) => value !== undefined;
const timezoneDate = /T.*(?:Z|[+-]\d{2}:\d{2})$/;

export class ReportQuery {
  @ApiPropertyOptional({
    format: 'date-time',
    description: `Inclusive, explicit UTC offset. Defaults to ${REPORT_DEFAULT_DAYS} days before until.`,
  })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  from?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Exclusive, explicit UTC offset. Defaults to database time.',
  })
  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezoneDate)
  until?: string;
}

export class ReportExportParams {
  @ApiProperty({ enum: REPORT_EXPORTS })
  @IsIn(REPORT_EXPORTS)
  kind!: ReportExport;
}
