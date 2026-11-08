import { ApiProperty } from '@nestjs/swagger';
import { PageMeta } from '../../core/responses.js';
export class GpsDeviceResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() deviceUid!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class DeviceAssignmentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ format: 'uuid' }) deviceId!: string;
  @ApiProperty({ format: 'date-time' }) assignedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  unassignedAt!: string | null;
  @ApiProperty({ type: GpsDeviceResponse }) device!: GpsDeviceResponse;
}
export class VehicleResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) branchId!:
    string | null;
  @ApiProperty() licensePlate!: string;
  @ApiProperty() make!: string;
  @ApiProperty() model!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  registrationExpiresOn!: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  insuranceExpiresOn!: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  nextMaintenanceOn!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  nextMaintenanceOdometer!: number | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: DeviceAssignmentResponse, nullable: true })
  currentAssignment!: DeviceAssignmentResponse | null;
}
export class VehiclePage extends PageMeta {
  @ApiProperty({ type: [VehicleResponse] }) data!: VehicleResponse[];
}
export class GpsDevicePage extends PageMeta {
  @ApiProperty({ type: [GpsDeviceResponse] }) data!: GpsDeviceResponse[];
}
export class DeviceAssignmentPage extends PageMeta {
  @ApiProperty({ type: [DeviceAssignmentResponse] })
  data!: DeviceAssignmentResponse[];
}
export class ServiceRecordResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ enum: ['MAINTENANCE', 'REGISTRATION', 'INSURANCE'] })
  kind!: string;
  @ApiProperty({ type: String, format: 'date' }) performedOn!: string;
  @ApiProperty({ type: Number, nullable: true }) odometer!: number | null;
  @ApiProperty({ type: String, nullable: true }) costVnd!: string | null;
  @ApiProperty() notes!: string;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class ServiceRecordPage extends PageMeta {
  @ApiProperty({ type: [ServiceRecordResponse] })
  data!: ServiceRecordResponse[];
}
