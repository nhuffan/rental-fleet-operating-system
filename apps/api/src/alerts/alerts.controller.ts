import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
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
} from '../auth/guards.js';
import { AlertPageResponse, AlertQuery } from './dto.js';
import { AlertsService } from './alerts.service.js';
@ApiTags('Operational alerts')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller('alerts')
export class AlertsController {
  constructor(@Inject(AlertsService) private readonly alerts: AlertsService) {}
  @Get()
  @RequirePermission('alert.read')
  @ApiOkResponse({ type: AlertPageResponse })
  list(@Req() request: AuthRequest, @Query() query: AlertQuery) {
    return this.alerts.list(request.tenant, query);
  }
}
