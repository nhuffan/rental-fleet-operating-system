# Backend epics for live operational screens

These are separate backend design tasks. This UI implementation creates no tables, endpoints or elevated permissions.

| Epic                   | Required before live UI                                                                                | Acceptance boundary                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Platform authorization | Dedicated platform principal, explicit permissions, server/backend guards and negative tests           | Tenant OWNER/ADMIN cannot obtain global access; never trust user metadata or menu visibility             |
| Platform read APIs     | Global business list/detail, user support view, aggregates, device/provider health                     | No browser iteration over tenant IDs, no service key in frontend, authorized pagination/filtering        |
| Platform writes        | Onboarding/suspension/configuration/entitlements, transaction-safe global audit                        | Confirm destructive effects; never simulate write success                                                |
| Platform audit         | Authorized global event API separate from tenant `/audit-logs`                                         | Redacted metadata and cross-tenant authorization tests                                                   |
| Fleet                  | Tenant-scoped vehicles, branch assignment, independent vehicle/GPS statuses                            | OpenAPI contracts, permissions, error and empty states before wiring previews                            |
| Rentals                | Reservation/active/complete lifecycle, conflict validation, due time and scoped customer access        | Backend serializes overlap checks; overdue derives from active rental end time                           |
| Telematics / Trips     | Authorized last-known location, lastSeen, stale/offline thresholds, provider ingestion, trip route API | Timestamp/timezone and freshness displayed explicitly; Mapbox integration only after location API exists |
| Commercial             | Deposit per rental, toll linked to trip/rental, revenue signals                                        | No P&L, depreciation or full accounting implied                                                          |

When enabling platform production routes, extend proxy authentication as defense in depth and add independent server/backend platform authorization. Current `/superadmin/*` is only a development redirect to synthetic fixtures, with production returning 404. The existing tenant OWNER role is not used for platform authorization.
