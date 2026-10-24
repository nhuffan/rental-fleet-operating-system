import type { components } from "@rental-fleet/contracts/src/openapi";
export type LocationPage = components["schemas"]["LocationPage"];
export type VehicleLocation = components["schemas"]["LocationResponse"];
export const gpsLabels: Record<string, string> = {
  FRESH: "Bản tin mới",
  STALE: "Bản tin trễ",
  OFFLINE: "Bản tin quá 10 phút",
  NO_DATA: "Chưa nhận bản tin",
  UNASSIGNED: "Chưa gắn thiết bị",
};

export const gpsDescriptions: Record<string, string> = {
  FRESH:
    "Bản tin GPS mới trong 2 phút; đây vẫn là vị trí được ghi nhận gần nhất.",
  STALE:
    "Bản tin đã trễ hơn 2 phút. Tọa độ là vị trí cuối ghi nhận, có thể đã thay đổi.",
  OFFLINE:
    "Chưa có bản tin mới hơn 10 phút. Tọa độ cũ không xác nhận vị trí hiện tại của xe.",
  NO_DATA:
    "Thiết bị đã được gắn nhưng chưa nhận bản tin hợp lệ trong lần gắn hiện tại.",
  UNASSIGNED: "Xe chưa có thiết bị đang gắn; chưa thể nhận vị trí cho xe.",
};
