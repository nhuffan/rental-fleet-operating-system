# Stage 3 Fleet Core — verification

Date: 22 October 2026. Source stage: [Stage_3_Fleet_Core_Implementation_Plan_Compact.md](stages/Stage_3_Fleet_Core_Implementation_Plan_Compact.md).

Implementation is in the existing project checkout on `main`, based on `ead0e8e6ccaa5fbf16b6c0126a9b78eebfd9d09c`.

## Code and local verification

- Default `pnpm build`: passed for API and production web.
- `pnpm lint`: passed without warnings.
- `pnpm typecheck`: passed for both applications.
- `pnpm test`: passed, **38 tests in 5 files**.
- Independent schema/API/UI review: completed; no remaining actionable findings.
- OpenAPI exported and TypeScript contracts regenerated from the built NestJS API.

The 38 local tests cover clean migration replay (9 RLS-enabled application tables), tenant foreign keys, canonical and tenant-unique plates, global provider/device UID uniqueness, temporal constraints, restrictive dependencies, partial unique assignment indexes, active-profile/membership/business RLS, direct-write denial, request validation, literal search/sorting/pagination, domain conflicts, transaction-time authorization rechecks, resource/audit rollback and database-clock assignment intervals.

## Development database

Confirmed `APP_ENV=development`, exact Supabase project `eeryymswcufnebibigqf` and matching existing demo fixture before remote operations. The project was initially paused; the user resumed it. A transient pooler routing error during restore cleared once the database became ready. A TLS-verified read and migration dry run then succeeded.

Only pending migration `20261022151714_fleet_core.sql` was applied through the existing Supabase CLI migration workflow. No staging/production project, Auth seed, schema reset or service key was used. Existing data was preserved.

## Real E2E and production boundary verification

Production HTTP boundary tests passed **12/12**, covering design preview 404s and private login redirects for SaaS Core and live Fleet routes.

The first real E2E run passed 18 tests and timed out one multi-request cross-tenant scenario at Vitest's default five-second timeout. The E2E test timeout was set to 30 seconds because every request performs real Supabase Auth verification; assertions and production implementation were unchanged. E2E suites are serialized because SaaS Core exercises revocation of shared disposable demo accounts. The final `pnpm test:e2e` rerun passed **19/19 tests in 2 files**, including the existing SaaS Core suite and 7 real Fleet scenarios.

Tests create uniquely named disposable vehicle/device/assignment records within the seeded development tenants and delete only records created by those tests. Audit records are retained as security evidence. Passwords, tokens and connection strings are never printed or committed.

## Browser verification against real development data

Used the production web build on `127.0.0.1:3100` and the API on `127.0.0.1:3001`, signing in with the existing development demo accounts. API `WEB_ORIGIN` was temporarily overridden to `http://127.0.0.1:3100` to match the QA port; real environment files were unchanged. No mock Auth/API server was used for this stage.

Verified through the UI:

- Empty Vehicles list, vehicle creation, plate normalization, active branch selection and persistent success feedback.
- GPS registration with provider normalization; two separately registered devices.
- Assign device A → end A → assign device B. The profile showed B as current and both history rows with A's end time preserved.
- Vehicle editing and success feedback. The form prevents disabling a vehicle while a device is attached and explains how to end the assignment first.
- OPERATIONS can view the list, profile and history; create/edit/assign/end controls are absent. API tests separately verify write denial.
- Loading state while fetching live data; a transient read failure showed the Fleet error panel, and **Thử lại** refetched successfully. A nonexistent valid vehicle ID showed the scoped “Không tìm thấy xe” screen.
- Profile/history at **1440, 768 and 390px**, with document width equal to viewport width and no whole-page horizontal overflow.

Evidence: [empty list](stage-3-screenshots/vehicles-empty-1440.png), [created vehicle](stage-3-screenshots/vehicles-created-1440.png), [GPS registry](stage-3-screenshots/gps-registry-1440.png), [assignment history desktop](stage-3-screenshots/vehicle-history-1440.png), [tablet](stage-3-screenshots/vehicle-history-768.png), [mobile](stage-3-screenshots/vehicle-history-390.png), [updated vehicle](stage-3-screenshots/vehicle-updated-1440.png), [Operations read-only profile](stage-3-screenshots/vehicle-operations-readonly-1440.png), [error](stage-3-screenshots/fleet-error-1440.png), [not found](stage-3-screenshots/vehicle-not-found-1440.png).

## Cleanup and process ownership

The browser created exactly **1 QA vehicle, 2 QA devices and 2 assignment rows**. After verification, a TLS-verified cleanup transaction checked their exact tenant/IDs/plate/UIDs/labels and removed only these disposable records. A subsequent query confirmed zero matching QA domain rows. All **7 corresponding audit events** were retained unchanged: vehicle create/update, two device creates, two assignment creates and one assignment end. E2E suites independently clean only their own domain records and retain audit evidence.

Remote migration history contains `20260923003003` and `20261022151714`. All **9 public application tables**, including the three Fleet tables, have RLS enabled.

Owned temporary processes: initial API session `93394` / PID `19127`; QA API session `64564` / PID `19518` on port `3001`; production web session `47834` / PID `19130` on port `3100`. All were stopped, and port/process checks confirmed exit. The temporary browser tab was closed and its viewport override reset.

## Scope boundary

Live: vehicle profiles/lifecycle, branch association, GPS registry, assignment history, tenant-scoped API/contracts, RBAC and audit.

Excluded: Rental/Customer, booking availability, GPS ingestion/Traccar, location/online telemetry/maps, Trips, Commercial and global Superadmin APIs. Registration/assignment does not imply a GPS connection; no mock telemetry or Rental statuses are rendered by live Vehicles routes.
