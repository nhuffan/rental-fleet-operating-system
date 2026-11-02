import { ApiProperty } from '@nestjs/swagger';
import { PricingSnapshotResponse } from '../pricing/responses.js';
export class ContractBusinessResponse {
  @ApiProperty() legalName!: string;
  @ApiProperty() name!: string;
  @ApiProperty() address!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() taxCode!: string;
  @ApiProperty() representativeName!: string;
  @ApiProperty() representativeTitle!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() currency!: string;
}
export class ContractCustomerResponse {
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() email!: string;
  @ApiProperty() idNumber!: string;
  @ApiProperty() address!: string;
  @ApiProperty() driverLicenseNumber!: string;
  @ApiProperty() driverLicenseClass!: string;
}
export class ContractVehicleResponse {
  @ApiProperty() licensePlate!: string;
  @ApiProperty() make!: string;
  @ApiProperty() model!: string;
}
export class ContractRentalResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) startAt!: string;
  @ApiProperty({ format: 'date-time' }) endAt!: string;
  @ApiProperty({ enum: ['RESERVED', 'ACTIVE', 'COMPLETED'] }) status!: string;
  @ApiProperty({
    description:
      'Exact database amount; legacy fractional values are not rounded.',
  })
  rentalAmount!: string;
  @ApiProperty() depositRequiredAmount!: string;
  @ApiProperty() depositReceived!: boolean;
  @ApiProperty() notes!: string;
}
export class ContractSnapshotResponse {
  @ApiProperty({ enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: ContractBusinessResponse })
  business!: ContractBusinessResponse;
  @ApiProperty({ type: ContractCustomerResponse })
  customer!: ContractCustomerResponse;
  @ApiProperty({ type: ContractVehicleResponse })
  vehicle!: ContractVehicleResponse;
  @ApiProperty({ type: ContractRentalResponse })
  rental!: ContractRentalResponse;
  @ApiProperty({ type: PricingSnapshotResponse, nullable: true })
  pricing!: PricingSnapshotResponse | null;
  @ApiProperty() terms!: string;
  @ApiProperty({ type: [String] }) missing!: string[];
}
export class ContractDocumentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty() seq!: number;
  @ApiProperty() docNumber!: string;
  @ApiProperty() version!: number;
  @ApiProperty() contentHash!: string;
  @ApiProperty({ type: ContractSnapshotResponse })
  snapshot!: ContractSnapshotResponse;
  @ApiProperty({ format: 'uuid' }) issuedBy!: string;
  @ApiProperty({ format: 'date-time' }) issuedAt!: string;
}
export class ContractVersionResponse {
  @ApiProperty() version!: number;
  @ApiProperty() docNumber!: string;
  @ApiProperty({ format: 'date-time' }) issuedAt!: string;
}
export class ContractDocumentsResponse {
  @ApiProperty({ type: ContractDocumentResponse, nullable: true })
  latest!: ContractDocumentResponse | null;
  @ApiProperty({
    type: [ContractVersionResponse],
    description:
      'Latest 100 versions; older versions remain accessible by version.',
  })
  versions!: ContractVersionResponse[];
  @ApiProperty() versionCount!: number;
  @ApiProperty() dataChanged!: boolean;
}
