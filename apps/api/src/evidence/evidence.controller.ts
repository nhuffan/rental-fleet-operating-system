import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  type PipeTransform,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { EvidenceService } from './evidence.service.js';
import { EvidenceUploadCreate } from './dto.js';
import {
  EvidenceReadAuthorization,
  EvidenceUploadAuthorization,
  EvidenceUploadResponse,
  RentalEvidenceResponse,
} from './responses.js';
class EmptyEvidenceBody implements PipeTransform {
  transform(value: unknown) {
    if (
      value === undefined ||
      (value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0)
    )
      return undefined;
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'This action accepts no request body',
    });
  }
}
@ApiTags('Inspection Evidence')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller('rentals/:rentalId/evidence')
export class EvidenceController {
  constructor(
    @Inject(EvidenceService) private readonly service: EvidenceService,
  ) {}
  @Post('uploads')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: EvidenceUploadAuthorization })
  begin(
    @Req() req: AuthRequest,
    @Param('rentalId', ParseUUIDPipe) id: string,
    @Body() body: EvidenceUploadCreate,
  ) {
    return this.service.begin(req.tenant, id, body, req.requestId);
  }
  @Post('uploads/:uploadId/verify')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: EvidenceUploadResponse })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false },
  })
  verify(
    @Req() req: AuthRequest,
    @Param('rentalId', ParseUUIDPipe) id: string,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Body(new EmptyEvidenceBody()) _body: unknown,
  ) {
    return this.service.verify(req.tenant, id, uploadId, req.requestId);
  }
  @Post('uploads/:uploadId/cancel')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: EvidenceUploadResponse })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false },
  })
  cancel(
    @Req() req: AuthRequest,
    @Param('rentalId', ParseUUIDPipe) id: string,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Body(new EmptyEvidenceBody()) _body: unknown,
  ) {
    return this.service.cancel(req.tenant, id, uploadId, req.requestId);
  }
  @Get()
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: RentalEvidenceResponse })
  list(@Req() req: AuthRequest, @Param('rentalId', ParseUUIDPipe) id: string) {
    return this.service.list(req.tenant, id);
  }
  @Get(':evidenceId/url')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: EvidenceReadAuthorization })
  read(
    @Req() req: AuthRequest,
    @Param('rentalId', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.service.signedRead(req.tenant, id, evidenceId);
  }
}
