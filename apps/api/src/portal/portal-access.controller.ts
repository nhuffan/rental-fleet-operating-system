import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
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
import { PortalAccessService } from './portal-access.service.js';
import {
  PortalAccessLinkResponse,
  PortalAccessStatusResponse,
} from './responses.js';

@ApiTags('Customer portal access')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller('customers/:id/portal-access')
export class PortalAccessController {
  constructor(
    @Inject(PortalAccessService) private readonly access: PortalAccessService,
  ) {}

  @Get()
  @RequirePermission('customer.read')
  @ApiOkResponse({ type: PortalAccessStatusResponse })
  status(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.access.status(r.tenant, id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('customer.manage')
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: PortalAccessLinkResponse })
  @ApiOperation({
    description:
      'Creates (or reissues) a private one-time password-setup link for the customer portal. Only an email without an existing account is accepted; no email is sent.',
  })
  issue(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.access.issue(r.tenant, id, r.requestId);
  }
}
