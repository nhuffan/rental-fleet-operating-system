# Customer and Rental Core

Stage 4 builds on Fleet Core and the existing verified tenant context. Customers and rentals are live application data; GPS telemetry, maps, trips, payments and accounting remain separate domains.

## Customer policy

A customer belongs to one Business. Name is trimmed and 1–120 characters; at least phone or email is required. Phone accepts 5–32 characters (digits, spaces/hyphens and an optional leading `+`); email is trimmed, lowercase and at most 254 characters. Contacts intentionally are not unique because households can share a phone/email. Notes are limited to 2,000 characters.

Customers have `ACTIVE` / `INACTIVE` lifecycle status. There is no hard-delete API. A customer with a RESERVED or ACTIVE rental cannot be disabled; complete or cancel the applicable rental first. Historical rentals retain their customer foreign key.

## Workflow and time

`DRAFT → RESERVED → ACTIVE → COMPLETED`; DRAFT or RESERVED can become CANCELLED. Handover changes RESERVED to ACTIVE and records `handedOverAt` plus `odometerStart`; Return changes ACTIVE to COMPLETED and records `returnedAt` plus `odometerEnd`. End odometer must be at least start odometer. Repeated or invalid actions return a conflict instead of duplicating milestones/audit events.

A draft does not hold a vehicle. Reserve rechecks that vehicle and customer are active, the planned interval has not ended and the vehicle is free. Handover is permitted only during the planned interval and rechecks that no other rental still holds the vehicle. Dates require an explicit UTC offset, are stored as `timestamptz` and displayed in Vietnam time. Action times and overdue calculations use the database clock.

`OVERDUE` is derived from `status = ACTIVE AND endAt <= now`; it is not persisted as a workflow status. Vehicle lifecycle remains `ACTIVE` / `INACTIVE`; rental displays can be AVAILABLE, RESERVED, RENTED or OVERDUE independently of lifecycle and GPS registration.

## Availability and concurrency

RESERVED/ACTIVE rentals block half-open intervals `[startAt, endAt)`. Adjacent rentals may share an endpoint. A PostgreSQL GiST exclusion constraint using `btree_gist` rejects overlapping blocking intervals for the same tenant/vehicle even outside the HTTP validation path. A partial unique index also permits only one ACTIVE rental per vehicle, protecting actual possession after a planned end time has passed.

A normal ACTIVE rental blocks its planned interval. Once overdue, it blocks new availability/reservation requests until returned, including requests after its old planned end. A previously made future reservation remains in history but cannot hand over while another rental is still ACTIVE. This makes the late return visible as an operational conflict.

All writes take the existing Business row lock, recheck active profile/business/membership and permission, then perform resource checks and audit insertion in one transaction. Reserving and extending recheck conflicts under this lock; database constraints provide a final guard. Disabling a vehicle with RESERVED/ACTIVE rentals is rejected.

## API and permissions

All paths are relative to `/api/v1`, require Supabase bearer authentication and verified tenant membership. Optional `X-Business-Id` selects an active membership. OWNER/ADMIN have `customer.read/manage` and `rental.read/manage`; OPERATIONS has read permissions only. Customer/Rental writes never trust client-supplied business IDs or Rental workflow status/milestone fields.

| Endpoint | Behavior |
| --- | --- |
| `GET/POST /customers`, `GET/PATCH /customers/:id` | List/read/create/update customer; status is a lifecycle flag |
| `GET/POST /rentals`, `GET/PATCH /rentals/:id` | List/read/create draft/update allowed fields |
| `POST /rentals/:id/reserve` | Empty body or `{}`; claim planned interval |
| `POST /rentals/:id/handover` | `{ odometerStart }`; activate during planned interval |
| `POST /rentals/:id/extend` | `{ endAt, rentalAmount? }`; strictly later end, reject conflicts |
| `POST /rentals/:id/return` | `{ odometerEnd }`; complete and release vehicle |
| `POST /rentals/:id/cancel` | `{ notes? }`; cancel draft/reservation, optionally replace notes |
| `GET /vehicles/availability` | Required startAt/endAt; page/limit/search/branchId/availableOnly; returns availability and reason per vehicle |
| `GET /vehicles/:id/rental-state` | Current/next rental and derived vehicle rental display state |

Draft PATCH may change customer, vehicle, interval, amounts, deposit fields and notes. RESERVED/ACTIVE PATCH changes only amounts/deposit/notes; interval extension uses its validated action. Terminal rentals are read-only. Odometer values are integers 0–2,147,483,647. Amount inputs are JSON numbers from zero to 999,999,999.99 with at most two decimal places; PostgreSQL stores exact `numeric(14,2)` values. Currency follows the Business setting. Deposit fields are only `depositRequiredAmount` and a simple `depositReceived` flag; no payment/refund ledger, transaction or reconciliation is implied.

Lists paginate on the server with a stable ID tie-breaker. Rentals filter by canonical status, customer, vehicle or derived overdue. Customer/rental forms use generated OpenAPI contracts and paginated selection; vehicle choice remains advisory until the backend rechecks on reserve.

## Data access and audit

Composite tenant foreign keys prevent foreign customer/vehicle assignment. Both new tables enable RLS, grant authenticated tenant reads and revoke direct Data API writes. Tenant predicates and authorization still apply to every NestJS query using its trusted database connection.

Mutation and audit events commit or roll back together. Audit metadata stores only request IDs and changed field names; names, contacts, notes, amounts and request bodies are not copied into metadata. There is no hard-delete or cross-tenant transfer API. SQL migrations under `supabase/migrations` remain the only migration history; Drizzle maps/query types only.
