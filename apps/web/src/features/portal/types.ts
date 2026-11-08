import type { components } from "@rental-fleet/contracts/src/openapi";
type Schemas = components["schemas"];
export type PortalMe = Schemas["PortalMeResponse"];
export type PortalRental = Schemas["PortalRentalResponse"];
export type PortalRentalPage = Schemas["PortalRentalPage"];
export type PortalRentalDetail = Schemas["PortalRentalDetailResponse"];
export type PortalAccessStatus = Schemas["PortalAccessStatusResponse"];
export type PortalAccessLink = Schemas["PortalAccessLinkResponse"];
