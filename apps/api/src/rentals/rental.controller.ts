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
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthGuard,
  PermissionGuard,
  RequirePermission,
  TenantGuard,
  type AuthRequest,
} from '../auth/guards.js';
import {
  CustomerCreate,
  CustomerQuery,
  CustomerUpdate,
  RentalCancel,
  RentalCreate,
  RentalExtend,
  RentalHandover,
  RentalQuery,
  RentalReturn,
  RentalUpdate,
  VehicleAvailabilityQuery,
} from './dto.js';
import {
  CustomerPage,
  CustomerResponse,
  RentalPage,
  RentalInspectionsResponse,
  VehicleLatestInspectionResponse,
  RentalResponse,
  VehicleAvailabilityPage,
  VehicleRentalStateResponse,
} from './responses.js';
import { RentalService } from './rental.service.js';
class EmptyRentalBodyPipe implements PipeTransform {
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
@ApiTags('Rental Core')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  required: false,
  description:
    'Select an active business membership. Defaults to oldest active membership.',
})
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller()
export class RentalController {
  constructor(
    @Inject(RentalService) private readonly rentalService: RentalService,
  ) {}
  @Get('customers')
  @RequirePermission('customer.read')
  @ApiOkResponse({ type: CustomerPage })
  customers(@Req() r: AuthRequest, @Query() q: CustomerQuery) {
    return this.rentalService.listCustomers(r.tenant, q);
  }
  @Get('customers/:id')
  @RequirePermission('customer.read')
  @ApiOkResponse({ type: CustomerResponse })
  customer(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.rentalService.customer(r.tenant, id);
  }
  @Post('customers')
  @RequirePermission('customer.manage')
  @ApiCreatedResponse({ type: CustomerResponse })
  createCustomer(@Req() r: AuthRequest, @Body() b: CustomerCreate) {
    return this.rentalService.createCustomer(r.tenant, b, r.requestId);
  }
  @Patch('customers/:id')
  @RequirePermission('customer.manage')
  @ApiOkResponse({ type: CustomerResponse })
  updateCustomer(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: CustomerUpdate,
  ) {
    return this.rentalService.updateCustomer(r.tenant, id, b, r.requestId);
  }
  @Get('rentals')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: RentalPage })
  rentals(@Req() r: AuthRequest, @Query() q: RentalQuery) {
    return this.rentalService.listRentals(r.tenant, q);
  }
  @Get('rentals/:id')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: RentalResponse })
  rental(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.rentalService.rental(r.tenant, id);
  }
  @Get('rentals/:id/inspections')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: RentalInspectionsResponse })
  @ApiOperation({
    description:
      'Immutable handover and return snapshots for this rental, in recorded order. Legacy rentals can have no snapshots.',
  })
  rentalInspections(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rentalService.rentalInspections(r.tenant, id);
  }
  @Post('rentals')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: RentalResponse })
  @ApiOperation({
    description:
      'Creates a DRAFT. A draft does not block a vehicle until reserve succeeds.',
  })
  createRental(@Req() r: AuthRequest, @Body() b: RentalCreate) {
    return this.rentalService.createRental(r.tenant, b, r.requestId);
  }
  @Patch('rentals/:id')
  @RequirePermission('rental.manage')
  @ApiOkResponse({ type: RentalResponse })
  @ApiOperation({
    description:
      'DRAFT: all supplied fields. RESERVED/ACTIVE: amounts, deposit and notes only; use extend for a later end. Terminal rentals are immutable.',
  })
  updateRental(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RentalUpdate,
  ) {
    return this.rentalService.updateRental(r.tenant, id, b, r.requestId);
  }
  @Post('rentals/:id/reserve')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: RentalResponse })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false },
  })
  @ApiOperation({
    description:
      'DRAFT to RESERVED, with overlap and active resource checks. Repeating a completed action returns 409 INVALID_RENTAL_STATE.',
  })
  reserve(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new EmptyRentalBodyPipe()) _body: unknown,
  ) {
    return this.rentalService.reserve(r.tenant, id, r.requestId);
  }
  @Post('rentals/:id/handover')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: RentalResponse })
  @ApiOperation({
    description:
      'RESERVED to ACTIVE within the planned rental period; atomically records the required immutable inspection, handover odometer, actor and database time. Repeated actions return 409.',
  })
  handover(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RentalHandover,
  ) {
    return this.rentalService.handover(r.tenant, id, b, r.requestId);
  }
  @Post('rentals/:id/extend')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: RentalResponse })
  @ApiOperation({
    description:
      'RESERVED/ACTIVE only; end must increase, be in the future and pass overlap checks. Amount is the new total, not an increment.',
  })
  extend(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RentalExtend,
  ) {
    return this.rentalService.extend(r.tenant, id, b, r.requestId);
  }
  @Post('rentals/:id/return')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: RentalResponse })
  @ApiOperation({
    description:
      'ACTIVE to COMPLETED, including overdue and legacy rentals; atomically records the required immutable return inspection. End odometer must be at least the handover reading. Inspection never creates charges or Commercial movements.',
  })
  returnRental(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RentalReturn,
  ) {
    return this.rentalService.returnRental(r.tenant, id, b, r.requestId);
  }
  @Post('rentals/:id/cancel')
  @RequirePermission('rental.manage')
  @ApiCreatedResponse({ type: RentalResponse })
  cancel(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RentalCancel,
  ) {
    return this.rentalService.cancel(r.tenant, id, b ?? {}, r.requestId);
  }
  // Registered before FleetController so the static path cannot be mistaken for a UUID.
  @Get('vehicles/availability')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: VehicleAvailabilityPage })
  @ApiOperation({
    description:
      'Half-open [startAt,endAt) availability. Active overdue vehicles block future intervals until returned. Results are advisory; every reservation write rechecks availability.',
  })
  availability(@Req() r: AuthRequest, @Query() q: VehicleAvailabilityQuery) {
    return this.rentalService.availability(r.tenant, q);
  }
  @Get('vehicles/:id/latest-inspection')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: VehicleLatestInspectionResponse })
  @ApiOperation({
    description:
      'Most recent immutable inspection for the selected tenant vehicle, or null when no inspection was recorded.',
  })
  vehicleLatestInspection(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rentalService.vehicleLatestInspection(r.tenant, id);
  }
  @Get('vehicles/:id/rental-state')
  @RequirePermission('rental.read')
  @ApiOkResponse({ type: VehicleRentalStateResponse })
  @ApiOperation({
    description:
      'Current effective state and current/next rental, separate from ACTIVE/INACTIVE vehicle lifecycle. A future reservation appears as nextRental while state remains AVAILABLE until its start.',
  })
  vehicleRentalState(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rentalService.vehicleRentalState(r.tenant, id);
  }
}
