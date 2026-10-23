import type { components } from "@rental-fleet/contracts/src/openapi";
export type LocationPage = components["schemas"]["LocationPage"];
export type VehicleLocation = components["schemas"]["LocationResponse"];
export const gpsLabels: Record<string, string> = {
  FRESH: "Tín hiệu mới",
  STALE: "Tín hiệu trễ",
  OFFLINE: "Mất kết nối",
  NO_DATA: "Chưa nhận bản tin",
  UNASSIGNED: "Chưa gắn thiết bị",
};
