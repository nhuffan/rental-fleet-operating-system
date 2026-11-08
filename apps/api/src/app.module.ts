import { ContractController } from './rentals/contract.controller.js';
import { ContractService } from './rentals/contract.service.js';
import { PricingController } from './pricing/pricing.controller.js';
import { PricingService } from './pricing/pricing.service.js';
import { TollController } from './tolls/toll.controller.js';
import { TollService } from './tolls/toll.service.js';
import { EvidenceRetentionController } from './evidence/retention.controller.js';
import { EvidenceRetentionControls } from './evidence/retention-controls.service.js';
import { EvidenceRetentionWorker } from './evidence/retention-worker.js';
import { EvidenceCleanup } from './evidence/evidence-cleanup.js';
import { EvidenceController } from './evidence/evidence.controller.js';
import { EvidenceService } from './evidence/evidence.service.js';
import { AlertsController } from './alerts/alerts.controller.js';
import { AlertsService } from './alerts/alerts.service.js';
import { CommercialController } from './commercial/commercial.controller.js';
import { CommercialService } from './commercial/commercial.service.js';
import { PlatformController } from './platform/platform.controller.js';
import { AuthAdminService } from './platform/auth-admin.service.js';
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
import { ReportsController } from './reports/reports.controller.js';
import { ReportsService } from './reports/reports.service.js';
import { CustomerGuard } from './portal/guards.js';
import { PortalAccessController } from './portal/portal-access.controller.js';
import { PortalAccessService } from './portal/portal-access.service.js';
import { PortalController } from './portal/portal.controller.js';
import { PortalService } from './portal/portal.service.js';
import { JobScheduler } from './jobs/job-scheduler.js';
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
    ContractController,
    AppController,
    AlertsController,
    CommercialController,
    PlatformController,
    CoreController,
    RentalController,
    EvidenceController,
    EvidenceRetentionController,
    FleetController,
    GpsController,
    TripController,
    TraccarController,
    TollController,
    PricingController,
    ReportsController,
    PortalController,
    PortalAccessController,
  ],
  providers: [
    ContractService,
    Database,
    AlertsService,
    CommercialService,
    TollService,
    PricingService,
    ReportsService,
    PortalService,
    JobScheduler,
    PortalAccessService,
    CustomerGuard,
    PlatformService,
    AuthAdminService,
    PlatformGuard,
    CoreService,
    FleetService,
    GpsService,
    GpsIngress,
    TripService,
    RentalService,
    EvidenceService,
    EvidenceRetentionControls,
    EvidenceRetentionWorker,
    EvidenceCleanup,
    AuthGuard,
    TenantGuard,
    PermissionGuard,
  ],
})
export class AppModule {}
