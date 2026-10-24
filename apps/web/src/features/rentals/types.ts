import type { components } from "@rental-fleet/contracts/src/openapi";
type Schemas = components["schemas"];
export type Customer = Schemas["CustomerResponse"];
export type CustomerPage = Schemas["CustomerPage"];
export type CustomerCreate = Schemas["CustomerCreate"];
export type CustomerUpdate = Schemas["CustomerUpdate"];
export type Rental = Schemas["RentalResponse"];
export type RentalPage = Schemas["RentalPage"];
export type RentalCreate = Schemas["RentalCreate"];
export type RentalUpdate = Schemas["RentalUpdate"];
export type VehicleAvailability = Schemas["VehicleAvailabilityResponse"];
export type VehicleRentalState = Schemas["VehicleRentalStateResponse"];

export type RentalInspection = Schemas["RentalInspectionResponse"];
export type RentalInspectionInput = Schemas["RentalInspectionInput"];
export type RentalInspections = Schemas["RentalInspectionsResponse"];
export type VehicleLatestInspection =
  Schemas["VehicleLatestInspectionResponse"];

export type Evidence = Schemas["EvidenceResponse"];
export type RentalEvidence = Schemas["RentalEvidenceResponse"];
export type EvidenceUpload = Schemas["EvidenceUploadResponse"];
export type EvidenceUploadAuthorization =
  Schemas["EvidenceUploadAuthorization"];
export type EvidenceReadAuthorization = Schemas["EvidenceReadAuthorization"];
