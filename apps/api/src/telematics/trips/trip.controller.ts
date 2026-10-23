import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthGuard,
  PermissionGuard,
  RequirePermission,
  TenantGuard,
  type AuthRequest,
} from '../../auth/guards.js';
import {
  TripPage,
  TripQuery,
  TripRoutePage,
  TripRouteQuery,
  TripSummary,
} from './dto.js';
import { TripService } from './trip.service.js';
@ApiTags('Derived trip history')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@RequirePermission('trip.read')
@Controller('trips')
export class TripController {
  constructor(@Inject(TripService) private readonly trips: TripService) {}
  @Get()
  @ApiOkResponse({ type: TripPage })
  list(@Req() r: AuthRequest, @Query() q: TripQuery) {
    return this.trips.list(r.tenant, q);
  }
  @Get(':id/route')
  @ApiOkResponse({ type: TripRoutePage })
  route(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Query() q: TripRouteQuery,
  ) {
    return this.trips.route(r.tenant, id, q);
  }
  @Get(':id')
  @ApiOkResponse({ type: TripSummary })
  get(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.trips.get(r.tenant, id);
  }
}
