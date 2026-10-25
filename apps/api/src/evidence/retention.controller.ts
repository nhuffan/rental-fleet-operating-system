import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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
  TenantGuard,
  PermissionGuard,
  RequirePermission,
  type AuthRequest,
} from '../auth/guards.js';
import { EvidenceRetentionControls } from './retention-controls.service.js';
import {
  EvidenceImportantUpdate,
  EvidenceRentalHoldUpdate,
  EvidenceRetentionSettingsUpdate,
} from './retention.dto.js';
import {
  EvidenceImportantResponse,
  EvidenceRentalHoldResponse,
  EvidenceRetentionSettingsResponse,
  EvidenceStorageUsageResponse,
} from './retention.responses.js';
@ApiTags('Evidence Retention')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller()
export class EvidenceRetentionController {
  constructor(
    @Inject(EvidenceRetentionControls)
    private readonly service: EvidenceRetentionControls,
  ) {}
  @Get('evidence/retention/settings')
  @RequirePermission('settings.read')
  @ApiOkResponse({ type: EvidenceRetentionSettingsResponse })
  settings(@Req() req: AuthRequest) {
    return this.service.settings(req.tenant);
  }
  @Patch('evidence/retention/settings')
  @RequirePermission('settings.update')
  @ApiOkResponse({ type: EvidenceRetentionSettingsResponse })
  updateSettings(
    @Req() req: AuthRequest,
    @Body() body: EvidenceRetentionSettingsUpdate,
  ) {
    return this.service.updateSettings(req.tenant, body, req.requestId);
  }
  @Get('evidence/storage-usage')
  @RequirePermission('settings.read')
  @ApiOkResponse({ type: EvidenceStorageUsageResponse })
  usage(@Req() req: AuthRequest) {
    return this.service.usage(req.tenant);
  }
  @Get('rentals/:rentalId/evidence/hold')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: EvidenceRentalHoldResponse })
  hold(
    @Req() req: AuthRequest,
    @Param('rentalId', ParseUUIDPipe) rentalId: string,
  ) {
    return this.service.hold(req.tenant, rentalId);
  }
  @Patch('rentals/:rentalId/evidence/hold')
  @RequirePermission('rental.manage')
  @ApiOkResponse({ type: EvidenceRentalHoldResponse })
  updateHold(
    @Req() req: AuthRequest,
    @Param('rentalId', ParseUUIDPipe) rentalId: string,
    @Body() body: EvidenceRentalHoldUpdate,
  ) {
    return this.service.updateHold(req.tenant, rentalId, body, req.requestId);
  }
  @Patch('rentals/:rentalId/evidence/:evidenceId/important')
  @RequirePermission('rental.manage')
  @ApiOkResponse({ type: EvidenceImportantResponse })
  important(
    @Req() req: AuthRequest,
    @Param('rentalId', ParseUUIDPipe) rentalId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() body: EvidenceImportantUpdate,
  ) {
    return this.service.updateImportant(
      req.tenant,
      rentalId,
      evidenceId,
      body,
      req.requestId,
    );
  }
}
