import type { components } from "@rental-fleet/contracts/src/openapi";
type Schemas = components["schemas"];
export type ReportSummary = Schemas["ReportSummaryResponse"];
export type ReportMonth = Schemas["ReportMonthResponse"];
export type ReportVehicle = Schemas["ReportVehicleResponse"];
