import { ApiProperty } from '@nestjs/swagger';

export class ReportMonthResponse {
  @ApiProperty({ description: 'Month in Asia/Ho_Chi_Minh, YYYY-MM.' })
  month!: string;
  @ApiProperty({ description: 'Exact whole VND string.' }) revenue!: string;
  @ApiProperty({ description: 'Exact whole VND string.' }) expenses!: string;
  @ApiProperty({ description: 'Revenue minus recorded expenses.' })
  estimatedProfit!: string;
}

export class ReportRentalStatusResponse {
  @ApiProperty() status!: string;
  @ApiProperty() count!: number;
}

export class ReportVehicleResponse {
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty() licensePlate!: string;
  @ApiProperty() make!: string;
  @ApiProperty() model!: string;
  @ApiProperty({ description: 'Exact whole VND string.' }) revenue!: string;
  @ApiProperty({ description: 'Rented hours inside the report window.' })
  rentedHours!: number;
  @ApiProperty({
    description: 'Scheduled/actual rented time divided by window, 0–100.',
  })
  utilizationPercent!: number;
}

export class ReportSummaryResponse {
  @ApiProperty({ enum: ['VND'] }) currency!: string;
  @ApiProperty({ enum: ['RECORDED_MOVEMENTS'] }) basis!: string;
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) until!: string;
  @ApiProperty() recordedRevenue!: string;
  @ApiProperty() cashReceived!: string;
  @ApiProperty() operatingExpenses!: string;
  @ApiProperty() estimatedProfit!: string;
  @ApiProperty() depositHeld!: string;
  @ApiProperty({ description: 'Average utilization of active vehicles.' })
  fleetUtilizationPercent!: number;
  @ApiProperty() activeVehicles!: number;
  @ApiProperty({ type: [ReportMonthResponse] }) months!: ReportMonthResponse[];
  @ApiProperty({ type: [ReportRentalStatusResponse] })
  rentalsByStatus!: ReportRentalStatusResponse[];
  @ApiProperty({
    type: [ReportVehicleResponse],
    description: 'Up to 50 active vehicles ordered by revenue then utilization.',
  })
  vehicles!: ReportVehicleResponse[];
}
