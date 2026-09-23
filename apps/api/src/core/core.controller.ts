import {
  MeResponse,
  BusinessResponse,
  BranchResponse,
  BranchPage,
  MembershipResponse,
  MembershipPage,
  SettingsResponse,
  AuditPage,
} from './responses.js';
import {
  Body,
  Controller,
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
  ApiHeader,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import {
  AuthGuard,
  PermissionGuard,
  RequirePermission,
  TenantGuard,
  type AuthRequest,
} from '../auth/guards.js';
import { CoreService } from './core.service.js';
import {
  BranchCreate,
  BranchUpdate,
  BusinessUpdate,
  MemberCreate,
  MemberUpdate,
  PageQuery,
  SettingsUpdate,
} from './dto.js';
@ApiTags('SaaS Core')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  required: false,
  description:
    'Select an active business membership. Defaults to oldest active membership.',
})
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller()
export class CoreController {
  constructor(@Inject(CoreService) private readonly core: CoreService) {}
  @Get('me') @ApiOkResponse({ type: MeResponse }) me(@Req() r: AuthRequest) {
    return this.core.me(r.tenant);
  }
  @Get('businesses/current')
  @RequirePermission('business.read')
  @ApiOkResponse({ type: BusinessResponse })
  business(@Req() r: AuthRequest) {
    return this.core.business(r.tenant);
  }
  @Patch('businesses/current')
  @RequirePermission('business.update')
  @ApiOkResponse({ type: BusinessResponse })
  updateBusiness(@Req() r: AuthRequest, @Body() b: BusinessUpdate) {
    return this.core.updateBusiness(r.tenant, b, r.requestId);
  }
  @Get('branches')
  @RequirePermission('branch.read')
  @ApiOkResponse({ type: BranchPage })
  branches(@Req() r: AuthRequest, @Query() q: PageQuery) {
    return this.core.listBranches(r.tenant, q);
  }
  @Get('branches/:id')
  @RequirePermission('branch.read')
  @ApiOkResponse({ type: BranchResponse })
  branch(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.core.branch(r.tenant, id);
  }
  @Post('branches')
  @RequirePermission('branch.manage')
  @ApiCreatedResponse({ type: BranchResponse })
  createBranch(@Req() r: AuthRequest, @Body() b: BranchCreate) {
    return this.core.createBranch(r.tenant, b, r.requestId);
  }
  @Patch('branches/:id')
  @RequirePermission('branch.manage')
  @ApiOkResponse({ type: BranchResponse })
  updateBranch(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: BranchUpdate,
  ) {
    return this.core.updateBranch(r.tenant, id, b, r.requestId);
  }
  @Get('memberships')
  @RequirePermission('user.read')
  @ApiOkResponse({ type: MembershipPage })
  members(@Req() r: AuthRequest, @Query() q: PageQuery) {
    return this.core.listMembers(r.tenant, q);
  }
  @Post('memberships')
  @RequirePermission('user.manage')
  @ApiCreatedResponse({ type: MembershipResponse })
  addMember(@Req() r: AuthRequest, @Body() b: MemberCreate) {
    return this.core.addMember(r.tenant, b, r.requestId);
  }
  @Patch('memberships/:id')
  @RequirePermission('user.manage')
  @ApiOkResponse({ type: MembershipResponse })
  updateMember(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: MemberUpdate,
  ) {
    return this.core.updateMember(r.tenant, id, b, r.requestId);
  }
  @Get('settings')
  @RequirePermission('settings.read')
  @ApiOkResponse({ type: SettingsResponse })
  settings(@Req() r: AuthRequest) {
    return this.core.getSettings(r.tenant);
  }
  @Patch('settings')
  @RequirePermission('settings.update')
  @ApiOkResponse({ type: SettingsResponse })
  updateSettings(@Req() r: AuthRequest, @Body() b: SettingsUpdate) {
    return this.core.updateSettings(r.tenant, b, r.requestId);
  }
  @Get('audit-logs')
  @RequirePermission('audit.read')
  @ApiOkResponse({ type: AuditPage })
  audit(@Req() r: AuthRequest, @Query() q: PageQuery) {
    return this.core.audit(r.tenant, q);
  }
}
