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
  ApiCreatedResponse,
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
import { TollService } from './toll.service.js';
import {
  TollBulkRecord,
  TollImportConfirm,
  TollImportPreview,
  TollQuery,
  TollRecord,
  TollReview,
} from './dto.js';
import {
  TollBulkResponse,
  TollDetailResponse,
  TollImportResponse,
  TollPage,
  TollPreviewResponse,
  TollResponse,
} from './responses.js';
@ApiTags('Toll Reconciliation')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller('tolls')
export class TollController {
  constructor(@Inject(TollService) private readonly service: TollService) {}
  @Post('imports/preview')
  @RequirePermission('commercial.read')
  @ApiCreatedResponse({ type: TollPreviewResponse })
  preview(@Req() req: AuthRequest, @Body() body: TollImportPreview) {
    return this.service.preview(req.tenant, body);
  }
  @Post('imports')
  @RequirePermission('commercial.manage')
  @ApiCreatedResponse({ type: TollImportResponse })
  import(@Req() req: AuthRequest, @Body() body: TollImportConfirm) {
    return this.service.import(req.tenant, body, req.requestId);
  }
  @Get()
  @RequirePermission('commercial.read')
  @ApiOkResponse({ type: TollPage })
  list(@Req() req: AuthRequest, @Query() query: TollQuery) {
    return this.service.list(req.tenant, query);
  }
  @Post('record')
  @RequirePermission('commercial.manage')
  @ApiCreatedResponse({ type: TollBulkResponse })
  bulk(@Req() req: AuthRequest, @Body() body: TollBulkRecord) {
    return this.service.bulkRecord(req.tenant, body, req.requestId);
  }
  @Get(':id')
  @RequirePermission('commercial.read')
  @ApiOkResponse({ type: TollDetailResponse })
  detail(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(req.tenant, id);
  }
  @Patch(':id/review')
  @RequirePermission('commercial.manage')
  @ApiOkResponse({ type: TollResponse })
  review(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TollReview,
  ) {
    return this.service.review(req.tenant, id, body, req.requestId);
  }
  @Post(':id/record')
  @RequirePermission('commercial.manage')
  @ApiCreatedResponse({ type: TollResponse })
  record(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TollRecord,
  ) {
    return this.service.record(req.tenant, id, body, req.requestId);
  }
}
