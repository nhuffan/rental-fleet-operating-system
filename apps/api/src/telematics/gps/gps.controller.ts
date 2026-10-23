import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  HttpException,
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
import { GpsIngress } from './ingress.js';
import { authenticateTraccar, normalizeTraccar } from './traccar.adapter.js';
import {
  IngestionResponse,
  LocationPage,
  LocationQuery,
  LocationResponse,
  TelemetryDiagnosticsResponse,
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
  @Get('fleet/telemetry/diagnostics')
  @RequirePermission('gps.read')
  @ApiOkResponse({ type: TelemetryDiagnosticsResponse })
  diagnostics(@Req() r: AuthRequest) {
    return this.gps.diagnostics(r.tenant);
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
  constructor(
    @Inject(GpsService) private readonly gps: GpsService,
    @Inject(GpsIngress) private readonly ingress: GpsIngress,
  ) {}
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
  async ingest(
    @Headers('x-traccar-token') token: string | undefined,
    @Body() body: unknown,
  ) {
    authenticateTraccar(token);
    let event;
    try {
      event = normalizeTraccar(body);
    } catch (error) {
      this.ingress.record('invalidPayload');
      throw error;
    }
    this.ingress.consumeDevice(event.provider, event.deviceUid);
    try {
      const result = await this.gps.ingest(event);
      this.ingress.record(result.duplicate ? 'duplicate' : 'accepted');
      return result;
    } catch (error) {
      this.ingress.record(
        error instanceof HttpException && error.getStatus() < 500
          ? 'resolutionRejected'
          : 'internalFailure',
      );
      throw error;
    }
  }
}
