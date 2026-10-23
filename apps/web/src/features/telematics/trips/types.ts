import type { components } from "@rental-fleet/contracts/src/openapi";
type Schemas = components["schemas"];
export type TripRange = Schemas["TripRange"];
export type Trip = Schemas["TripSummary"];
export type TripPage = Schemas["TripPage"];
export type TripPoint = Schemas["TripPoint"];
export type TripRoute = Schemas["TripRoutePage"];
