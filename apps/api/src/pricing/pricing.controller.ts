import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthGuard,
  TenantGuard,
  PermissionGuard,
  RequirePermission,
  type AuthRequest,
} from '../auth/guards.js';
import { PricingService } from './pricing.service.js';
import {
  QuotePreviewInput,
  RateCardCreate,
  RateCardDelete,
  RateCardQuery,
  RateCardUpdate,
} from './dto.js';
import {
  PricingQuoteResponse,
  RateCardDeletedResponse,
  RateCardPage,
  RateCardResponse,
} from './responses.js';
@ApiTags('Rental Pricing')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller('pricing')
export class PricingController {
  constructor(
    @Inject(PricingService) private readonly service: PricingService,
  ) {}
  @Get('rates')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: RateCardPage })
  list(@Req() r: AuthRequest, @Query() q: RateCardQuery) {
    return this.service.list(r.tenant, q);
  }
  @Get('rates/:id')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: RateCardResponse })
  detail(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(r.tenant, id);
  }
  @Post('rates')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: RateCardResponse })
  create(@Req() r: AuthRequest, @Body() b: RateCardCreate) {
    return this.service.create(r.tenant, b, r.requestId);
  }
  @Patch('rates/:id')
  @RequirePermission('rental.manage')
  @ApiOkResponse({ type: RateCardResponse })
  @ApiOperation({
    description:
      'Replaces the editable rate-card configuration, with optimistic version protection; confirmed rental snapshots remain unchanged.',
  })
  update(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RateCardUpdate,
  ) {
    return this.service.update(r.tenant, id, b, r.requestId);
  }
  @Delete('rates/:id')
  @RequirePermission('rental.manage')
  @ApiOkResponse({ type: RateCardDeletedResponse })
  @ApiOperation({
    description:
      'Deletes an unused card only; deactivate a card referenced by an immutable rental quotation.',
  })
  delete(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: RateCardDelete,
  ) {
    return this.service.delete(r.tenant, id, q, r.requestId);
  }
  @Post('quote')
  @RequirePermission('rental.read')
  @ApiCreatedResponse({ type: PricingQuoteResponse })
  @ApiOperation({
    description:
      'Read-only estimate for the pickup instant, vehicle card before business default. Explicit UTC-offset timestamps; VND integer arithmetic; no financial movement.',
  })
  preview(@Req() r: AuthRequest, @Body() b: QuotePreviewInput) {
    return this.service.preview(r.tenant, b);
  }
}
