import type { components } from "@rental-fleet/contracts/src/openapi";
type Schemas = components["schemas"];
export type PlatformMe = Schemas["PlatformMe"];
export type PlatformCounts = Schemas["PlatformCounts"];
export type PlatformGps = Schemas["PlatformGpsHealth"];
export type PlatformBusiness = Schemas["PlatformBusiness"];
export type PlatformBusinessPage = Schemas["PlatformBusinessPage"];
export type PlatformOverview = Schemas["PlatformOverview"];
export type PlatformAuditEntry = Schemas["PlatformAuditEntry"];
export type PlatformAuditPage = Schemas["PlatformAuditPage"];
export type PlatformUser = Schemas["PlatformUser"];
export type PlatformUserPage = Schemas["PlatformUserPage"];
export type PlatformUserDetail = Schemas["PlatformUserDetail"];

export type PlatformBusinessDetail = Schemas["PlatformBusinessDetail"];
export type PlatformBusinessCreate = Schemas["PlatformBusinessCreate"];
export type PlatformProvisioningResponse =
  Schemas["PlatformProvisioningResponse"];
export type PlatformOwnerLinkResponse = Schemas["PlatformOwnerLinkResponse"];
export type PlatformBusinessRecord = Schemas["PlatformBusinessRecord"];
