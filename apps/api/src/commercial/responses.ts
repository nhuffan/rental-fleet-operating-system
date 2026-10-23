import { ApiProperty } from '@nestjs/swagger';
import { PageMeta } from '../core/responses.js';
import {
  COMMERCIAL_CATEGORIES,
  COMMERCIAL_KINDS,
  COMMERCIAL_STATUSES,
} from './dto.js';
export class CommercialMovementResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) businessId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) vehicleId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) rentalId!:
    string | null;
  @ApiProperty({ enum: COMMERCIAL_KINDS }) kind!: string;
  @ApiProperty({ enum: COMMERCIAL_CATEGORIES }) category!: string;
  @ApiProperty({
    description:
      'Positive whole VND string. REVERSAL has the opposite effect to its original movement.',
  })
  amount!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty() reference!: string;
  @ApiProperty() notes!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) reversalOf!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) reversedBy!:
    string | null;
  @ApiProperty({ enum: COMMERCIAL_STATUSES }) status!: string;
}
export class CommercialMovementPage extends PageMeta {
  @ApiProperty({ type: [CommercialMovementResponse] })
  data!: CommercialMovementResponse[];
}
export class CommercialSummaryResponse {
  @ApiProperty({ enum: ['VND'] }) currency!: string;
  @ApiProperty({
    enum: ['RECORDED_MOVEMENTS'],
    description:
      'Recorded rental payments and miscellaneous income plus noncash deposit retention; excludes contracted/projected amounts.',
  })
  basis!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) from!:
    string | null;
  @ApiProperty({ format: 'date-time' }) until!: string;
  @ApiProperty({
    description:
      'Whole VND string: recorded payments, miscellaneous income and deposit retention, net of corrections.',
  })
  recordedRevenue!: string;
  @ApiProperty({
    description:
      'Whole VND string: rental payments plus miscellaneous income; excludes deposits and noncash retention.',
  })
  cashReceived!: string;
  @ApiProperty() operatingExpenses!: string;
  @ApiProperty({
    description:
      'Recorded revenue minus recorded operating expenses. Estimate, excludes unrecorded costs.',
  })
  estimatedProfit!: string;
  @ApiProperty({
    description:
      'Cash received minus operating expenses; deposit movements excluded.',
  })
  netOperatingCashFlow!: string;
  @ApiProperty({
    description:
      'Cumulative deposit receipts minus refunds and retained amounts before until, ignoring from.',
  })
  depositHeld!: string;
}
export class RentalCommercialResponse {
  @ApiProperty({ format: 'uuid' }) rentalId!: string;
  @ApiProperty({ format: 'uuid' }) vehicleId!: string;
  @ApiProperty({ enum: ['VND'] }) currency!: string;
  @ApiProperty({
    description:
      'Rental Core amount rounded to whole VND half up; never counted as recorded receipt.',
  })
  contractedAmount!: string;
  @ApiProperty() recordedRentalPayments!: string;
  @ApiProperty() outstandingAmount!: string;
  @ApiProperty() overpaidAmount!: string;
  @ApiProperty({
    description:
      'Required deposit rounded to whole VND half up; historical depositReceived boolean is not a payment.',
  })
  depositRequired!: string;
  @ApiProperty() depositReceived!: string;
  @ApiProperty() depositRefunded!: string;
  @ApiProperty() depositRetained!: string;
  @ApiProperty() depositBalance!: string;
  @ApiProperty({ type: CommercialSummaryResponse })
  summary!: CommercialSummaryResponse;
}
