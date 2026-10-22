# Fleet Core

Stage source: [Stage_3_Fleet_Core_Implementation_Plan_Compact.md](stages/Stage_3_Fleet_Core_Implementation_Plan_Compact.md).

## Entities and ownership

- `vehicles`: tenant-owned profile (`licensePlate`, `make`, `model`, optional branch), lifecycle `ACTIVE`/`INACTIVE`. No `AVAILABLE`/`RENTED` state or booking availability exists. A canonical plate is unique within its business even while inactive.
- `gps_devices`: tenant-owned registry identity (`provider`, `deviceUid`), optional label and lifecycle `ACTIVE`/`INACTIVE`. Provider is lowercase; UID is trimmed and case-sensitive. Global uniqueness of `(provider, device_uid)` prevents the same provider identity being claimed by another business. Provider, UID and business ownership cannot be patched.
- `device_assignments`: tenant/vehicle/device, server-owned assigned/end timestamps. Composite foreign keys enforce matching tenant ownership. Partial unique indexes permit one active device per vehicle and one active vehicle per device. Historical rows and dependencies are retained; no hard-delete endpoint exists.

The SQL migration is `20261022151714_fleet_core.sql`; Drizzle maps the same constraints/indexes. RLS requires an active business, membership and profile. Authenticated Data API access is read-only and tenant filtered; anonymous reads and direct writes are denied.

## API and permissions

All paths are under `/api/v1`, require a verified Supabase bearer token, and use the backend-selected active business. `X-Business-Id` is only a selection hint validated against membership.

| Endpoint                                                  | Permission       | Behavior                                                  |
| --------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `GET /vehicles`, `GET /vehicles/:id`                      | `vehicle.read`   | Profile + current device assignment                       |
| `POST /vehicles`, `PATCH /vehicles/:id`                   | `vehicle.manage` | Create/update profile and lifecycle                       |
| `GET /gps-devices`                                        | `gps.read`       | Registry list, optional available-device filter           |
| `POST /gps-devices`, `PATCH /gps-devices/:id`             | `gps.manage`     | Register device; update only label/status                 |
| `GET /vehicles/:id/device-assignments`                    | `vehicle.read`   | Paginated assignment history                              |
| `POST /vehicles/:id/device-assignments`                   | `vehicle.manage` | Assign one active, unassigned device to an active vehicle |
| `POST /vehicles/:id/device-assignments/:assignmentId/end` | `vehicle.manage` | End the active assignment; empty body only                |

OWNER/ADMIN have all four Fleet permissions; OPERATIONS has `vehicle.read` and `gps.read`. Lists use validated page/limit (max 100), search/status filters, allowlisted sort columns/order and stable ID tie-breaking. Vehicle lists also filter branch; devices filter provider and `available=true`. No device selection is silently capped to the first page in the UI.

## Transaction and audit invariants

Every write acquires the verified business row lock and rechecks current business/profile/membership/permission before mutating. Resource changes and audit inserts commit together. The same lock is used by SaaS Core administration, so a concurrent membership revocation cannot be bypassed by a stale guard context. Unique constraints remain a second defense against competing inserts. Wrapped PostgreSQL errors map to stable public conflict codes without serializing database details.

New branch associations require an active branch from the same tenant. Inactivating an assigned vehicle/device is rejected until its current assignment ends. Assignment timestamps come from `clock_timestamp()` after acquiring the lock; ending uses the database clock with a lower bound of its assignment start. Identity fields and ended history cannot be rewritten through the API.

Audit actions: `vehicle.create`, `vehicle.update`, `gps_device.create`, `gps_device.update`, `device_assignment.assign`, `device_assignment.end`. Metadata contains request ID and changed field names, not request bodies, credentials or tracker identifiers.

## UI boundary

`/app/vehicles`, `/app/vehicles/devices` and `/app/vehicles/:id` use API data, with permission-aware forms, server filtering/pagination, 404/loading/error/empty states and persistent success/error feedback. Tenant switching reloads the document to discard prior tenant client state. Device connection/position is explicitly unavailable: registration/assignment does not imply online GPS. Existing map/rental/platform design previews remain development-only.

GPS ingestion/Traccar, maps/locations, Rental/Customer, Trips, Commercial and global Superadmin APIs are outside this stage.
