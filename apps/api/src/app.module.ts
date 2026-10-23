import { GpsController, TraccarController } from './gps/gps.controller.js';
import { GpsService } from './gps/gps.service.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { Database } from './database/database.js';
import { CoreController } from './core/core.controller.js';
import { CoreService } from './core/core.service.js';
import { FleetController } from './fleet/fleet.controller.js';
import { FleetService } from './fleet/fleet.service.js';
import { RentalController } from './rental/rental.controller.js';
import { RentalService } from './rental/rental.service.js';
import { AuthGuard, TenantGuard, PermissionGuard } from './auth/guards.js';
@Module({
  controllers: [
    AppController,
    CoreController,
    RentalController,
    FleetController,
    GpsController,
    TraccarController,
  ],
  providers: [
    Database,
    CoreService,
    FleetService,
    GpsService,
    RentalService,
    AuthGuard,
    TenantGuard,
    PermissionGuard,
  ],
})
export class AppModule {}
