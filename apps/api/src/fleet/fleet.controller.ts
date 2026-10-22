import {
  BadRequestException,
  type PipeTransform,
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
  ApiBody,
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
import { PageQuery } from '../core/dto.js';
import {
  DeviceAssignmentCreate,
  GpsDeviceCreate,
  GpsDeviceQuery,
  GpsDeviceUpdate,
  VehicleCreate,
  VehicleQuery,
  VehicleUpdate,
} from './dto.js';
import {
  DeviceAssignmentPage,
  DeviceAssignmentResponse,
  GpsDevicePage,
  GpsDeviceResponse,
  VehiclePage,
  VehicleResponse,
} from './responses.js';
import { FleetService } from './fleet.service.js';
class EmptyAssignmentBodyPipe implements PipeTransform {
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
      message: 'This endpoint accepts no request body',
    });
  }
}
@ApiTags('Fleet Core')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  required: false,
  description:
    'Select an active business membership. Defaults to oldest active membership.',
})
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller()
export class FleetController {
  constructor(@Inject(FleetService) private readonly fleet: FleetService) {}
  @Get('vehicles')
  @RequirePermission('vehicle.read')
  @ApiOkResponse({ type: VehiclePage })
  vehicles(@Req() r: AuthRequest, @Query() q: VehicleQuery) {
    return this.fleet.listVehicles(r.tenant, q);
  }
  @Get('vehicles/:id')
  @RequirePermission('vehicle.read')
  @ApiOkResponse({ type: VehicleResponse })
  vehicle(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.vehicle(r.tenant, id);
  }
  @Post('vehicles')
  @RequirePermission('vehicle.manage')
  @ApiCreatedResponse({ type: VehicleResponse })
  createVehicle(@Req() r: AuthRequest, @Body() b: VehicleCreate) {
    return this.fleet.createVehicle(r.tenant, b, r.requestId);
  }
  @Patch('vehicles/:id')
  @RequirePermission('vehicle.manage')
  @ApiOkResponse({ type: VehicleResponse })
  updateVehicle(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: VehicleUpdate,
  ) {
    return this.fleet.updateVehicle(r.tenant, id, b, r.requestId);
  }
  @Get('gps-devices')
  @RequirePermission('gps.read')
  @ApiOkResponse({ type: GpsDevicePage })
  devices(@Req() r: AuthRequest, @Query() q: GpsDeviceQuery) {
    return this.fleet.listDevices(r.tenant, q);
  }
  @Post('gps-devices')
  @RequirePermission('gps.manage')
  @ApiCreatedResponse({ type: GpsDeviceResponse })
  createDevice(@Req() r: AuthRequest, @Body() b: GpsDeviceCreate) {
    return this.fleet.createDevice(r.tenant, b, r.requestId);
  }
  @Patch('gps-devices/:id')
  @RequirePermission('gps.manage')
  @ApiOkResponse({ type: GpsDeviceResponse })
  updateDevice(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: GpsDeviceUpdate,
  ) {
    return this.fleet.updateDevice(r.tenant, id, b, r.requestId);
  }
  @Get('vehicles/:id/device-assignments')
  @RequirePermission('vehicle.read')
  @ApiOkResponse({ type: DeviceAssignmentPage })
  assignments(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PageQuery,
  ) {
    return this.fleet.listAssignments(r.tenant, id, q);
  }
  @Post('vehicles/:id/device-assignments')
  @RequirePermission('vehicle.manage')
  @ApiCreatedResponse({ type: DeviceAssignmentResponse })
  assignDevice(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: DeviceAssignmentCreate,
  ) {
    return this.fleet.assignDevice(r.tenant, id, b, r.requestId);
  }
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false },
  })
  @Post('vehicles/:id/device-assignments/:assignmentId/end')
  @RequirePermission('vehicle.manage')
  @ApiCreatedResponse({ type: DeviceAssignmentResponse })
  endAssignment(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body(new EmptyAssignmentBodyPipe()) _body: unknown,
  ) {
    return this.fleet.endAssignment(r.tenant, id, assignmentId, r.requestId);
  }
}
