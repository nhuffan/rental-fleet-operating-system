import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthGuard,
  PermissionGuard,
  RequirePermission,
  TenantGuard,
  type AuthRequest,
} from '../auth/guards.js';
import { AiAnswerResponse, AiQueryDto } from './ai.dto.js';
import { AiService } from './ai.service.js';

@ApiTags('AI assistant')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller('ai')
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Post('query')
  @HttpCode(200)
  @RequirePermission('alert.read')
  @ApiOperation({
    description:
      'Read-only operations assistant. Answers are grounded in allowlisted tenant-scoped tools; the model never selects a business or writes data.',
  })
  @ApiOkResponse({ type: AiAnswerResponse })
  query(@Req() r: AuthRequest, @Body() body: AiQueryDto) {
    return this.ai.query(r.tenant, body.question);
  }
}
