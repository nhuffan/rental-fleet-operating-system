import { ApiProperty } from '@nestjs/swagger';
export class UserResponse {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
}
export class BusinessResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() status!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class BusinessChoice {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['OWNER'] }) role!: string;
}
export class MeResponse {
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
  @ApiProperty({ type: BusinessResponse }) business!: BusinessResponse;
  @ApiProperty({ enum: ['OWNER'] }) role!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ type: [BusinessChoice] }) businesses!: BusinessChoice[];
}
export class BranchResponse {
  @ApiProperty() id!: string;
  @ApiProperty() businessId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() address!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class MembershipResponse {
  @ApiProperty() id!: string;
  @ApiProperty() businessId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ required: false }) displayName?: string;
  @ApiProperty({ enum: ['OWNER'] }) roleKey!: string;
  @ApiProperty() status!: string;
}
export class PageMeta {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
}
export class BranchPage extends PageMeta {
  @ApiProperty({ type: [BranchResponse] }) data!: BranchResponse[];
}
export class MembershipPage extends PageMeta {
  @ApiProperty({ type: [MembershipResponse] }) data!: MembershipResponse[];
}
export class SettingsResponse {
  @ApiProperty() businessId!: string;
  @ApiProperty({
    type: 'object',
    properties: { locale: { type: 'string' }, dateFormat: { type: 'string' } },
  })
  config!: { locale?: string; dateFormat?: string };
  @ApiProperty({ required: false, format: 'date-time' }) updatedAt?: string;
}
export class AuditResponse {
  @ApiProperty() id!: string;
  @ApiProperty() businessId!: string;
  @ApiProperty() actorUserId!: string;
  @ApiProperty() action!: string;
  @ApiProperty() entityType!: string;
  @ApiProperty() entityId!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class AuditPage extends PageMeta {
  @ApiProperty({ type: [AuditResponse] }) data!: AuditResponse[];
}
