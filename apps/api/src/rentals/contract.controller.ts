import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
  type PipeTransform,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AuthGuard,
  TenantGuard,
  PermissionGuard,
  RequirePermission,
  type AuthRequest,
} from '../auth/guards.js';
import { ContractService } from './contract.service.js';
import {
  ContractDocumentResponse,
  ContractDocumentsResponse,
} from './contract-responses.js';
class EmptyContractBody implements PipeTransform {
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
      message: 'Contract issuance accepts no request fields',
    });
  }
}
@ApiTags('Rental contract documents')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller('rentals/:id/contract')
export class ContractController {
  constructor(
    @Inject(ContractService) private readonly service: ContractService,
  ) {}
  @Get()
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: ContractDocumentsResponse })
  list(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.list(r.tenant, id);
  }
  @Get(':version')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: ContractDocumentResponse })
  version(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    if (version < 1 || version > 2147483647)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid contract version',
      });
    return this.service.version(r.tenant, id, version);
  }
  @Post()
  @RequirePermission('rental.manage')
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false },
  })
  @ApiCreatedResponse({ type: ContractDocumentResponse })
  @ApiOkResponse({ type: ContractDocumentResponse })
  @ApiOperation({
    description:
      'Issues an immutable contract version under the tenant lock. Returns the identical latest snapshot with HTTP200 when content is unchanged. Does not sign a legal agreement or create a financial movement.',
  })
  async issue(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new EmptyContractBody()) _body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.issue(r.tenant, id, r.requestId);
    response.status(result.created ? 201 : 200);
    return result.document;
  }
}
