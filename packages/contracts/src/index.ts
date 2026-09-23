import type { components } from "./openapi";
export type Me = components["schemas"]["MeResponse"];
export type Role = Me["role"];
export type Business = components["schemas"]["BusinessResponse"];
export type Branch = components["schemas"]["BranchResponse"];
export type Membership = components["schemas"]["MembershipResponse"];
export type Settings = components["schemas"]["SettingsResponse"];
export type Page<T> = { data: T[]; page: number; limit: number; total: number };
export type ApiError = {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
};
