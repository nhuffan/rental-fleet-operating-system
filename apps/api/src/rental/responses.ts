import { ApiProperty } from '@nestjs/swagger';
import { PageMeta } from '../core/responses.js';
import { RENTAL_STATUSES } from './dto.js';
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
