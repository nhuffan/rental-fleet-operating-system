import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards.js';
import { PageQuery } from '../core/dto.js';
import { ContractDocumentResponse } from '../rentals/contract-responses.js';
import { CustomerGuard, type CustomerRequest } from './guards.js';
import { PortalService } from './portal.service.js';
import {
  PortalMeResponse,
  PortalRentalDetailResponse,
  PortalRentalPage,
} from './responses.js';

@ApiTags('Customer portal')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('portal')
export class PortalController {
  constructor(@Inject(PortalService) private readonly portal: PortalService) {}

  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: PortalMeResponse })
  me(@Req() r: CustomerRequest) {
    return this.portal.me(r.identity.id);
  }

  @Get('rentals')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: PortalRentalPage })
  rentals(@Req() r: CustomerRequest, @Query() q: PageQuery) {
    return this.portal.rentals(r.identity.id, q);
  }

  @Get('rentals/:id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: PortalRentalDetailResponse })
  rental(
    @Req() r: CustomerRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portal.rental(r.identity.id, id);
  }

  @Get('rentals/:id/contract/:version')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: ContractDocumentResponse })
  contract(
    @Req() r: CustomerRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    if (version < 1 || version > 2147483647)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid contract version',
      });
    return this.portal.contract(r.identity.id, id, version);
  }
}
