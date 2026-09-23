import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  ValidateIf,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class PageQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class BusinessUpdate {
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name?: string;
  @ApiPropertyOptional({ example: 'Asia/Ho_Chi_Minh' })
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @Length(1, 80)
  timezone?: string;
  @ApiPropertyOptional({ example: 'VND' })
  @ValidateIf((_o, value) => value !== undefined)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
export class BranchCreate {
  @ApiProperty() @IsString() @Length(1, 120) @Matches(/\S/) name!: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @Length(0, 500)
  address?: string;
}
export class BranchUpdate {
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @Length(0, 500)
  address?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: string;
}
export class MemberCreate {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;
  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'OPERATIONS'] })
  @IsIn(['OWNER', 'ADMIN', 'OPERATIONS'])
  roleKey!: string;
}
export class MemberUpdate {
  @ApiPropertyOptional({ enum: ['OWNER', 'ADMIN', 'OPERATIONS'] })
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['OWNER', 'ADMIN', 'OPERATIONS'])
  roleKey?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: string;
}
export class SettingsConfig {
  @ApiPropertyOptional({ enum: ['vi', 'en'] })
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['vi', 'en'])
  locale?: string;
  @ApiPropertyOptional({ enum: ['DMY', 'ISO'] })
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['DMY', 'ISO'])
  dateFormat?: string;
}
export class SettingsUpdate {
  @ApiProperty({ type: SettingsConfig })
  @IsObject()
  @ValidateNested()
  @Type(() => SettingsConfig)
  config!: SettingsConfig;
}
