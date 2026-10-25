import { ApiProperty } from '@nestjs/swagger';
import { PageMeta } from '../core/responses.js';
import { BILLING_MODES } from './dto.js';
export class RateCardResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) vehicleId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) vehiclePlate!: string | null;
  @ApiProperty({ enum: ['VEHICLE', 'BUSINESS'] }) scope!:
    'VEHICLE' | 'BUSINESS';
  @ApiProperty({ type: String, nullable: true }) hourlyRate!: string | null;
  @ApiProperty({ type: String, nullable: true }) dailyRate!: string | null;
  @ApiProperty() minimumCharge!: string;
  @ApiProperty({ type: String, nullable: true }) extraHourRate!: string | null;
  @ApiProperty({ format: 'date-time' }) effectiveFrom!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  effectiveUntil!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: 'ACTIVE' | 'INACTIVE';
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class RateCardPage extends PageMeta {
  @ApiProperty({ type: [RateCardResponse] }) data!: RateCardResponse[];
}
export class PricingLineResponse {
  @ApiProperty({ enum: ['HOUR', 'DAY', 'EXTRA_HOUR', 'DAY_CAP', 'MINIMUM'] })
  kind!: 'HOUR' | 'DAY' | 'EXTRA_HOUR' | 'DAY_CAP' | 'MINIMUM';
  @ApiProperty() units!: string;
  @ApiProperty() unitPrice!: string;
  @ApiProperty() amount!: string;
}
export class PricingBreakdownResponse {
  @ApiProperty({ enum: ['VND'] }) currency!: 'VND';
  @ApiProperty({ enum: ['Asia/Ho_Chi_Minh'] }) timeZone!: 'Asia/Ho_Chi_Minh';
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ format: 'date-time' }) startAt!: string;
  @ApiProperty({ format: 'date-time' }) endAt!: string;
  @ApiProperty() durationSeconds!: string;
  @ApiProperty({ enum: BILLING_MODES }) billingMode!: 'HOURLY' | 'DAILY';
  @ApiProperty({ format: 'uuid' }) rateCardId!: string;
  @ApiProperty() rateVersion!: number;
  @ApiProperty() rateName!: string;
  @ApiProperty({ enum: ['VEHICLE', 'BUSINESS'] }) rateSource!:
    'VEHICLE' | 'BUSINESS';
  @ApiProperty({ type: String, nullable: true }) hourlyRate!: string | null;
  @ApiProperty({ type: String, nullable: true }) dailyRate!: string | null;
  @ApiProperty() minimumCharge!: string;
  @ApiProperty({ type: String, nullable: true }) extraHourRate!: string | null;
  @ApiProperty({ format: 'date-time' }) effectiveFrom!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  effectiveUntil!: string | null;
  @ApiProperty({ type: [PricingLineResponse] }) lines!: PricingLineResponse[];
  @ApiProperty() calculatedAmount!: string;
  @ApiProperty() quoteHash!: string;
}
export class PricingQuoteResponse {
  @ApiProperty() available!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['NO_RATE', 'BILLING_MODE_UNAVAILABLE'],
  })
  reason!: 'NO_RATE' | 'BILLING_MODE_UNAVAILABLE' | null;
  @ApiProperty({
    description:
      'Fingerprint of the selected schedule/rate state, including a missing-rate preview.',
  })
  quoteHash!: string;
  @ApiProperty({ enum: ['VND'] }) currency!: 'VND';
  @ApiProperty({ enum: ['Asia/Ho_Chi_Minh'] }) timeZone!: 'Asia/Ho_Chi_Minh';
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ format: 'date-time' }) startAt!: string;
  @ApiProperty({ format: 'date-time' }) endAt!: string;
  @ApiProperty({ type: String, nullable: true, enum: BILLING_MODES })
  billingMode!: 'HOURLY' | 'DAILY' | null;
  @ApiProperty({ type: String, nullable: true }) totalAmount!: string | null;
  @ApiProperty({ type: RateCardResponse, nullable: true })
  rate!: RateCardResponse | null;
  @ApiProperty({ type: PricingBreakdownResponse, nullable: true })
  breakdown!: PricingBreakdownResponse | null;
}
export class PricingSnapshotResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) rateCardId!:
    string | null;
  @ApiProperty({ enum: ['CALCULATED', 'OVERRIDE', 'MANUAL'] }) mode!:
    'CALCULATED' | 'OVERRIDE' | 'MANUAL';
  @ApiProperty({ type: PricingBreakdownResponse, nullable: true })
  breakdown!: PricingBreakdownResponse | null;
  @ApiProperty() agreedAmount!: string;
  @ApiProperty({ type: String, nullable: true }) overrideReason!: string | null;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class RateCardDeletedResponse {
  @ApiProperty() deleted!: boolean;
}
