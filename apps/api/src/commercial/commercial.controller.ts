import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
  PermissionGuard,
  RequirePermission,
  TenantGuard,
  type AuthRequest,
} from '../auth/guards.js';
import {
  CommercialMovementCreate,
  CommercialMovementQuery,
  CommercialMovementReverse,
  CommercialSummaryQuery,
} from './dto.js';
import {
  CommercialMovementPage,
  CommercialMovementResponse,
  CommercialSummaryResponse,
  RentalCommercialResponse,
} from './responses.js';
import { CommercialService } from './commercial.service.js';
@ApiTags('Commercial Core')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  required: false,
  description: 'Select an active Owner business membership.',
})
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller()
export class CommercialController {
  constructor(
    @Inject(CommercialService) private readonly commercial: CommercialService,
  ) {}
  @Get('commercial/movements')
  @RequirePermission('commercial.read')
  @ApiOkResponse({ type: CommercialMovementPage })
  list(@Req() r: AuthRequest, @Query() q: CommercialMovementQuery) {
    return this.commercial.list(r.tenant, q);
  }
  @Get('commercial/summary')
  @RequirePermission('commercial.read')
  @ApiOkResponse({ type: CommercialSummaryResponse })
  @ApiOperation({
    description:
      'Exact VND strings. Period revenue includes noncash deposit retention; deposits are excluded from operating cash flow. Deposit held is cumulative before until, ignoring from. Reversals take effect at correction time.',
  })
  summary(@Req() r: AuthRequest, @Query() q: CommercialSummaryQuery) {
    return this.commercial.summary(r.tenant, q);
  }
  @Get('commercial/movements/:id')
  @RequirePermission('commercial.read')
  @ApiOkResponse({ type: CommercialMovementResponse })
  detail(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.commercial.detail(r.tenant, id);
  }
  @Post('commercial/movements')
  @RequirePermission('commercial.manage')
  @ApiCreatedResponse({ type: CommercialMovementResponse })
  create(@Req() r: AuthRequest, @Body() body: CommercialMovementCreate) {
    return this.commercial.create(r.tenant, body, r.requestId);
  }
  @Post('commercial/movements/:id/reverse')
  @RequirePermission('commercial.manage')
  @ApiCreatedResponse({ type: CommercialMovementResponse })
  @ApiOperation({
    description:
      'One immutable mirror correction per original. A reversal cannot be reversed. Database correction time determines the reporting period. Cannot create a negative deposit balance.',
  })
  reverse(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CommercialMovementReverse,
  ) {
    return this.commercial.reverse(r.tenant, id, body, r.requestId);
  }
  @Get('rentals/:id/commercial')
  @RequirePermission('commercial.read')
  @ApiOkResponse({ type: RentalCommercialResponse })
  rental(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.commercial.rentalSummary(r.tenant, id);
  }
}
