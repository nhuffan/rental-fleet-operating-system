import type { components } from "@rental-fleet/contracts/src/openapi";
type Schemas = components["schemas"];
export type Movement = Schemas["CommercialMovementResponse"];
export type MovementPage = Schemas["CommercialMovementPage"];
export type MovementCreate = Schemas["CommercialMovementCreate"];
export type MovementReverse = Schemas["CommercialMovementReverse"];
export type CommercialSummary = Schemas["CommercialSummaryResponse"];
export type RentalCommercial = Schemas["RentalCommercialResponse"];
export type MovementKind = MovementCreate["kind"];
