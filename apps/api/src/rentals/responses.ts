import { ApiProperty } from '@nestjs/swagger';
import { PageMeta } from '../core/responses.js';
import { RentalPricingSelection } from '../pricing/dto.js';
import { PricingSnapshotResponse } from '../pricing/responses.js';
import {
  INSPECTION_CHECK_STATES,
  INSPECTION_CONDITIONS,
  RENTAL_STATUSES,
  type InspectionCheckState,
  type InspectionCondition,
} from './dto.js';
export class CustomerResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() email!: string;
  @ApiProperty() notes!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class RentalVehicleResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) branchId!:
    string | null;
  @ApiProperty() licensePlate!: string;
  @ApiProperty() make!: string;
  @ApiProperty() model!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class RentalResponse {
  @ApiProperty({ type: PricingSnapshotResponse, nullable: true })
  quotation!: PricingSnapshotResponse | null;
  @ApiProperty({ type: RentalPricingSelection, nullable: true })
  pricingDraft!: RentalPricingSelection | null;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty({ format: 'uuid' }) customerId!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ format: 'date-time' }) startAt!: string;
  @ApiProperty({ format: 'date-time' }) endAt!: string;
  @ApiProperty({ enum: RENTAL_STATUSES }) status!: string;
  @ApiProperty({ minimum: 0, maximum: 999999999.99 }) rentalAmount!: number;
  @ApiProperty({ minimum: 0, maximum: 999999999.99 })
  depositRequiredAmount!: number;
  @ApiProperty() depositReceived!: boolean;
  @ApiProperty() notes!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reservedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  handedOverAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  returnedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt!: string | null;
  @ApiProperty({ type: Number, nullable: true }) odometerStart!: number | null;
  @ApiProperty({ type: Number, nullable: true }) odometerEnd!: number | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty() isOverdue!: boolean;
  @ApiProperty({ type: CustomerResponse }) customer!: CustomerResponse;
  @ApiProperty({ type: RentalVehicleResponse }) vehicle!: RentalVehicleResponse;
}
export class CustomerPage extends PageMeta {
  @ApiProperty({ type: [CustomerResponse] }) data!: CustomerResponse[];
}
export class RentalPage extends PageMeta {
  @ApiProperty({ type: [RentalResponse] }) data!: RentalResponse[];
}
export class VehicleAvailabilityResponse extends RentalVehicleResponse {
  @ApiProperty() available!: boolean;
  @ApiProperty({
    type: String,
    enum: ['INACTIVE', 'RESERVED', 'RENTED', 'OVERDUE'],
    nullable: true,
  })
  reason!: string | null;
}
export class VehicleAvailabilityPage extends PageMeta {
  @ApiProperty({ type: [VehicleAvailabilityResponse] })
  data!: VehicleAvailabilityResponse[];
}
export class VehicleRentalStateResponse {
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({
    enum: ['AVAILABLE', 'INACTIVE', 'RESERVED', 'RENTED', 'OVERDUE'],
  })
  state!: string;
  @ApiProperty({ type: RentalResponse, nullable: true })
  currentRental!: RentalResponse | null;
  @ApiProperty({ type: RentalResponse, nullable: true })
  nextRental!: RentalResponse | null;
}

export class RentalInspectionResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ enum: ['HANDOVER', 'RETURN'] }) type!: 'HANDOVER' | 'RETURN';
  @ApiProperty({ format: 'uuid' }) actorId!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({ minimum: 0, maximum: 2147483647 }) odometer!: number;
  @ApiProperty({ minimum: 0, maximum: 100 }) fuelPercent!: number;
  @ApiProperty({ enum: INSPECTION_CONDITIONS })
  exteriorCondition!: InspectionCondition;
  @ApiProperty({ enum: INSPECTION_CONDITIONS })
  interiorCondition!: InspectionCondition;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES })
  spareTire!: InspectionCheckState;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES }) tools!: InspectionCheckState;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES })
  registrationDocument!: InspectionCheckState;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES })
  insuranceDocument!: InspectionCheckState;
  @ApiProperty({ enum: INSPECTION_CHECK_STATES }) keys!: InspectionCheckState;
  @ApiProperty({ maxLength: 2000 }) damageNotes!: string;
  @ApiProperty({ maxLength: 2000 }) notes!: string;
}
export class RentalInspectionsResponse {
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ type: [RentalInspectionResponse], maxItems: 2 })
  data!: RentalInspectionResponse[];
}
export class VehicleLatestInspectionResponse {
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ type: RentalInspectionResponse, nullable: true })
  inspection!: RentalInspectionResponse | null;
}
