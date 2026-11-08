import { ApiProperty } from '@nestjs/swagger';
import { PageMeta } from '../core/responses.js';
import { ContractVersionResponse } from '../rentals/contract-responses.js';

export class PortalMeResponse {
  @ApiProperty({ format: 'uuid' }) customerId!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty() businessName!: string;
}
export class PortalRentalResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] })
  status!: string;
  @ApiProperty({ format: 'date-time' }) startAt!: string;
  @ApiProperty({ format: 'date-time' }) endAt!: string;
  @ApiProperty() licensePlate!: string;
  @ApiProperty() make!: string;
  @ApiProperty() model!: string;
  @ApiProperty({ description: 'Exact database amount string.' })
  rentalAmount!: string;
  @ApiProperty({ description: 'Exact database amount string.' })
  depositRequiredAmount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() contractCount!: number;
}
export class PortalRentalPage extends PageMeta {
  @ApiProperty({ type: [PortalRentalResponse] }) data!: PortalRentalResponse[];
}
export class PortalRentalDetailResponse extends PortalRentalResponse {
  @ApiProperty({ type: [ContractVersionResponse] })
  contracts!: ContractVersionResponse[];
}
export class PortalAccessStatusResponse {
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;
}
export class PortalAccessLinkResponse {
  @ApiProperty({
    description:
      'One-time private link. Returned with no-store; never log, email or audit it.',
  })
  accessUrl!: string;
  @ApiProperty({ description: 'True when a new Auth identity was created.' })
  created!: boolean;
}
