# Backend epics for live operational screens

This list began with the UI design rollout. Stage 3 implements Fleet Core (vehicles, GPS device registry, assignment history, RBAC and audit); Stage 4 adds live Customer/Rental lifecycle, reservations and derived availability; Stage 5 adds TEST-labelled Traccar ingestion and tenant current-location APIs. Remaining domain epics below are separate work.

| Epic                     | Required before live UI                                                                                | Acceptance boundary                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Platform authorization   | Dedicated platform principal, explicit permissions, server/backend guards and negative tests           | Tenant OWNER/ADMIN cannot obtain global access; never trust user metadata or menu visibility             |
| Platform read APIs       | Global business list/detail, user support view, aggregates, device/provider health                     | No browser iteration over tenant IDs, no service key in frontend, authorized pagination/filtering        |
| Platform writes          | Onboarding/suspension/configuration/entitlements, transaction-safe global audit                        | Confirm destructive effects; never simulate write success                                                |
| Platform audit           | Authorized global event API separate from tenant `/audit-logs`                                         | Redacted metadata and cross-tenant authorization tests                                                   |
| Fleet Core (implemented) | Tenant-scoped vehicles, branch assignment, GPS device registry and assignment history                  | Live `/app/vehicles` and generated contracts; telemetry/ingestion remains separate                       |
| Rentals (implemented)    | Customer registry, reservation/active/complete/cancel lifecycle, handover/return, extensions and availability | GiST exclusion and tenant transaction lock prevent overlap; overdue is derived; no payment ledger |
| GPS PoC (implemented) | Trusted Traccar TEST ingestion, tenant current locations, lastSeen/freshness, live Leaflet map | TEST source stays explicit; no physical-device or production-provider claim; see [GPS PoC](gps-poc.md) |
| Trips / GPS productionization | Physical device/provider validation, durable ingestion deployment, trip route API, production monitoring/retention | Current-position PoC does not imply trip history, alerts or production readiness |
| Commercial               | Deposit per rental, toll linked to trip/rental, revenue signals                                        | No P&L, depreciation or full accounting implied                                                          |

When enabling platform production routes, extend proxy authentication as defense in depth and add independent server/backend platform authorization. Current `/superadmin/*` is only a development redirect to synthetic fixtures, with production returning 404. The existing tenant OWNER role is not used for platform authorization.
