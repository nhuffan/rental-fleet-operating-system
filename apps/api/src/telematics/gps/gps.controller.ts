import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Req } from '@nestjs/common';
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
  TenantGuard,
  RequirePermission,
  type AuthRequest,
} from '../../auth/guards.js';
import { GpsService } from './gps.service.js';
import { authenticateTraccar, normalizeTraccar } from './traccar.adapter.js';
import {
  IngestionResponse,
  LocationPage,
  LocationQuery,
  LocationResponse,
} from './dto.js';
@ApiTags('GPS locations')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller()
export class GpsController {
  constructor(@Inject(GpsService) private readonly gps: GpsService) {}
  @Get('fleet/locations')
  @RequirePermission('gps.read')
  @ApiOkResponse({ type: LocationPage })
  list(@Req() r: AuthRequest, @Query() q: LocationQuery) {
    return this.gps.list(r.tenant, q);
  }
  @Get('vehicles/:id/location')
  @RequirePermission('gps.read')
  @ApiOkResponse({ type: LocationResponse })
  get(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.gps.get(r.tenant, id);
  }
}
@ApiTags('Trusted GPS ingestion')
@Controller('integrations/traccar')
export class TraccarController {
  constructor(@Inject(GpsService) private readonly gps: GpsService) {}
  @Post('positions')
  @ApiHeader({ name: 'X-Traccar-Token', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      description:
        'Traccar JSON position forwarding envelope; TEST source only',
      properties: {
        device: {
          type: 'object',
          properties: { uniqueId: { type: 'string' } },
        },
        position: {
          type: 'object',
          properties: {
            fixTime: { type: 'string', format: 'date-time' },
            valid: { type: 'boolean' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            speed: { type: 'number', description: 'Knots' },
            course: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiCreatedResponse({ type: IngestionResponse })
  ingest(
    @Headers('x-traccar-token') token: string | undefined,
    @Body() body: unknown,
  ) {
    authenticateTraccar(token);
    return this.gps.ingest(normalizeTraccar(body));
  }
}
