import type { components } from "@rental-fleet/contracts/src/openapi";
type Schemas = components["schemas"];
export type RateCard = Schemas["RateCardResponse"];
export type PricingQuote = Schemas["PricingQuoteResponse"];
export type PricingBreakdown = Schemas["PricingBreakdownResponse"];
export type PricingSnapshot = Schemas["PricingSnapshotResponse"];
export type RentalPricingSelection = Schemas["RentalPricingSelection"];
export type RateCardPage = Schemas["RateCardPage"];
