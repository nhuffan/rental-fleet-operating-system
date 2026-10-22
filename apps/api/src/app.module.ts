import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { Database } from './database/database.js';
import { CoreController } from './core/core.controller.js';
import { CoreService } from './core/core.service.js';
import { FleetController } from './fleet/fleet.controller.js';
import { FleetService } from './fleet/fleet.service.js';
import { AuthGuard, TenantGuard, PermissionGuard } from './auth/guards.js';
@Module({
  controllers: [AppController, CoreController, FleetController],
  providers: [
    Database,
    CoreService,
    FleetService,
    AuthGuard,
    TenantGuard,
    PermissionGuard,
  ],
})
export class AppModule {}
