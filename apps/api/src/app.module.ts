import { PlatformController } from './platform/platform.controller.js';
import { PlatformService } from './platform/platform.service.js';
import { PlatformGuard } from './platform/guards.js';
import { GpsIngress } from './telematics/gps/ingress.js';
import { TripController } from './telematics/trips/trip.controller.js';
import { TripService } from './telematics/trips/trip.service.js';
import {
  GpsController,
  TraccarController,
} from './telematics/gps/gps.controller.js';
import { GpsService } from './telematics/gps/gps.service.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { Database } from './database/database.js';
import { CoreController } from './core/core.controller.js';
import { CoreService } from './core/core.service.js';
import { FleetController } from './fleet/vehicles/fleet.controller.js';
import { FleetService } from './fleet/vehicles/fleet.service.js';
import { RentalController } from './rentals/rental.controller.js';
import { RentalService } from './rentals/rental.service.js';
import { AuthGuard, TenantGuard, PermissionGuard } from './auth/guards.js';
@Module({
  controllers: [
    AppController,
    PlatformController,
    CoreController,
    RentalController,
    FleetController,
    GpsController,
    TripController,
    TraccarController,
  ],
  providers: [
    Database,
    PlatformService,
    PlatformGuard,
    CoreService,
    FleetService,
    GpsService,
    GpsIngress,
    TripService,
    RentalService,
    AuthGuard,
    TenantGuard,
    PermissionGuard,
  ],
})
export class AppModule {}
