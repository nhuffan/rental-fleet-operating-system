import type { components } from "@rental-fleet/contracts/src/openapi";

type Schemas = components["schemas"];
export type Vehicle = Schemas["VehicleResponse"];
export type VehiclePage = Schemas["VehiclePage"];
export type GpsDevice = Schemas["GpsDeviceResponse"];
export type GpsDevicePage = Schemas["GpsDevicePage"];
export type DeviceAssignment = Schemas["DeviceAssignmentResponse"];
export type DeviceAssignmentPage = Schemas["DeviceAssignmentPage"];
export type VehicleCreate = Schemas["VehicleCreate"];
export type VehicleUpdate = Schemas["VehicleUpdate"];
export type GpsDeviceCreate = Schemas["GpsDeviceCreate"];
export type GpsDeviceUpdate = Schemas["GpsDeviceUpdate"];
export type DeviceAssignmentCreate = Schemas["DeviceAssignmentCreate"];
export type ServiceRecord = Schemas["ServiceRecordResponse"];
export type ServiceRecordPage = Schemas["ServiceRecordPage"];
export type ServiceRecordCreate = Schemas["ServiceRecordCreate"];
