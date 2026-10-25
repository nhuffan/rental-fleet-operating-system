import type { components } from "@rental-fleet/contracts/src/openapi";
type Schemas = components["schemas"];
export type Toll = Schemas["TollResponse"];
export type TollPage = Schemas["TollPage"];
export type TollDetail = Schemas["TollDetailResponse"];
export type TollPreview = Schemas["TollPreviewResponse"];
export type TollImportResult = Schemas["TollImportResponse"];
export type TollImportInput = Schemas["TollImportPreview"] & {
  delimiter: "," | ";" | "\t";
  dateFormat: "ISO_OFFSET" | "ISO_LOCAL" | "DMY_LOCAL";
  amountFormat: "INTEGER" | "DOT_GROUPED" | "COMMA_GROUPED";
};
