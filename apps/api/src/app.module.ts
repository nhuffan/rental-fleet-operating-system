import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { Database } from './database/database.js';
import { CoreController } from './core/core.controller.js';
import { CoreService } from './core/core.service.js';
import { AuthGuard, TenantGuard, PermissionGuard } from './auth/guards.js';
@Module({
  controllers: [AppController, CoreController],
  providers: [Database, CoreService, AuthGuard, TenantGuard, PermissionGuard],
})
export class AppModule {}
