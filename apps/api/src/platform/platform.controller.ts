import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PageQuery } from '../core/dto.js';
import { AuthGuard } from '../auth/guards.js';
import {
  PlatformGuard,
  RequirePlatformPermission,
  type PlatformRequest,
} from './guards.js';
import {
  PlatformAuditPage,
  PlatformAuditQuery,
  PlatformUserPage,
  PlatformUserQuery,
  PlatformUserDetail,
  PlatformBusiness,
  PlatformBusinessPage,
  PlatformBusinessQuery,
  PlatformMe,
  PlatformOverview,
} from './dto.js';
import { PlatformService } from './platform.service.js';
@ApiTags('Platform read console')
@ApiBearerAuth()
@UseGuards(AuthGuard, PlatformGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    @Inject(PlatformService) private readonly platform: PlatformService,
  ) {}
  @Get('me') @ApiOkResponse({ type: PlatformMe }) me(
    @Req() r: PlatformRequest,
  ) {
    return this.platform.me(r.platform, r.requestId);
  }
  @Get('overview')
  @RequirePlatformPermission('platform.overview.read')
  @ApiOkResponse({ type: PlatformOverview })
  overview(@Req() r: PlatformRequest) {
    return this.platform.overview(r.platform, r.requestId);
  }
  @Get('businesses')
  @RequirePlatformPermission('platform.business.read')
  @ApiOkResponse({ type: PlatformBusinessPage })
  businesses(@Req() r: PlatformRequest, @Query() q: PlatformBusinessQuery) {
    return this.platform.businesses(r.platform, q, r.requestId);
  }
  @Get('audit')
  @RequirePlatformPermission('platform.audit.read')
  @ApiOkResponse({ type: PlatformAuditPage })
  audit(@Req() r: PlatformRequest, @Query() q: PlatformAuditQuery) {
    return this.platform.audit(r.platform, q, r.requestId);
  }
  @Get('users')
  @RequirePlatformPermission('platform.user.read')
  @ApiOkResponse({ type: PlatformUserPage })
  users(@Req() r: PlatformRequest, @Query() q: PlatformUserQuery) {
    return this.platform.users(r.platform, q, r.requestId);
  }
  @Get('users/:id')
  @RequirePlatformPermission('platform.user.read')
  @ApiOkResponse({ type: PlatformUserDetail })
  user(
    @Req() r: PlatformRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PageQuery,
  ) {
    return this.platform.user(r.platform, id, q, r.requestId);
  }
  @Get('businesses/:id')
  @RequirePlatformPermission('platform.business.read')
  @ApiOkResponse({ type: PlatformBusiness })
  business(@Req() r: PlatformRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.platform.business(r.platform, id, r.requestId);
  }
}
