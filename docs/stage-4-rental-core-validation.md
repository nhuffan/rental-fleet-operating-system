# Stage 4 Customer/Rental Core — verification

Implementation and verification: 22–23 October 2026 (Asia/Ho_Chi_Minh). Source: [Stage_4_Rental_Core_Implementation_Plan_Compact.md](stages/Stage_4_Rental_Core_Implementation_Plan_Compact.md).

Implemented in the user's existing project checkout `/Users/nhuffan/Documents/Projects/Car Rental Fleet Operation ` (directory has a trailing space), on `main` at the requested baseline `4b8baa2e4e7a9b1d8242f65f21dfb7926b44ca94`.

## Code verification

- `pnpm lint`: passed without warnings.
- `pnpm test`: **94/94 tests in 9 files**, including existing SaaS/Fleet tests, 15 new database invariant/RLS tests and 41 new Rental DTO/domain/service cases.
- OpenAPI and generated TypeScript contracts exported from the built API without starting an HTTP server.
- Independent schema/API review found no remaining actionable findings. UI review checked tenant state, permissions, pagination, UTC conversion and fixture boundaries; draft edit recovery, phone length, notes limits and money display were corrected and re-reviewed.

Database replay uses clean PGlite PostgreSQL instances with the real `btree_gist` extension. Checks include tenant composite foreign keys, half-open overlap exclusion (`23P01`), adjacent UTC intervals, active possession uniqueness, date/money/state/milestone/odometer constraints, restrictive dependencies, direct-write denial and revocation-sensitive RLS. Service tests include fresh authorization after the tenant lock, resource/transition/audit rollback, overdue occupancy, expiry and allowed/invalid transitions.

## Development database

Verified exact development project `eeryymswcufnebibigqf` (`rental-fleet-dev`, ACTIVE_HEALTHY), existing baseline migration history and 9 existing public application tables before migration. CLI dry run and migration list showed exactly one pending file, `20261022163648_rental_core.sql`. The existing `pnpm db:migrate` workflow applied it to development only. No schema reset, seed, staging/production change or new migration history system was used.

All **11 public application tables** have RLS enabled after migration. The `btree_gist` extension is installed in the `extensions` schema, and the exclusion uses UUID/range values. The current PostgreSQL minor-upgrade notice about existing GiST float/NaN indexes does not apply to these new UUID/range indexes.

Supabase security advisors before and after showed the same existing Auth leaked-password-protection warning; no new database security advisory was introduced. Performance advisors reported only unused-index information on small development data (existing branches index and new customer/rental created-time indexes); required constraints/list indexes were retained. [Password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Real development E2E

`pnpm test:e2e`: **27/27 tests in 3 files**, including 8 new Customer/Rental scenarios and the complete SaaS/Fleet regression suites. Completed in approximately 127 seconds. Test accounts authenticate through real Supabase Auth, the API uses the real TLS-verified development database, and RLS checks call the real Data API.

Coverage:

- Customer contact validation/normalization/nonunique contact policy; money/date/status injection validation.
- OWNER/ADMIN management and OPERATIONS reads with every write/action denied.
- Customer → Draft → Reserve → Handover/Active → Extend → Return/Complete, actual odometers/milestones and redacted audit.
- Two simultaneous requests competing to reserve the same vehicle: exactly one succeeds; adjacent bookings allowed and cancellation releases the interval.
- Extension overlap rejection with unchanged rental/end time/audit; inactive resources, premature handover and invalid transitions.
- Overdue remains ACTIVE, blocks future availability/reservations until Return, and leaves vehicle lifecycle unchanged. Elapsed time is simulated by updating only one recorded suite-owned development record; the production clock is unchanged.
- Known cross-tenant customer/rental/vehicle IDs rejected for reads/writes/lifecycle actions; forged tenant selection denied.
- Membership-scoped Data API reads, anonymous denial and direct write denial for both new tables.

Suites run serially because the SaaS Core suite exercises revocation on shared disposable demo users. Each suite deletes only recorded domain IDs it created; audit events remain. No passwords, bearer tokens or database connection strings are logged or committed.

## Production build and browser QA

`pnpm build` and `pnpm typecheck` passed for both applications with the default Turbopack production build. Production boundary tests passed **17/17**, including new customer/rental list/detail/create private routes and existing preview/SaaS/Fleet boundaries. Web lint/typecheck passed after the final source changes.

Port 3001 was occupied by user-owned development processes. QA initially used API 3101 and web 3100; after the interrupted turn, an unrelated application occupied 3101. That application was left untouched. The final authenticated QA ran against a dedicated API on **3211** and production web on **3100**. Public/internal API origins were overridden only for the QA build/runtime; real environment files were unchanged. The default production build was restored after QA.

Browser access was initially disabled in Work settings. The user enabled it and asked to continue; authenticated QA then completed using real development Supabase demo accounts, without a mock Auth/API server.

Verified in the browser:

- Customer create, missing-contact validation, profile edit/save feedback and real rental history.
- Reservation wizard: explicit Vietnam-time dates, paginated available vehicle/customer pickers, exact decimal money display and real draft/reserve writes.
- Reserve → Handover/ACTIVE → Extend → Return/COMPLETED. Odometer 12,000 → 12,250 km and lifecycle timestamps were retained; invalid 11,999 km return was blocked.
- Draft save, date editing using keyboard input, vehicle/customer picker selection and save, then a separate reserve action and cancellation. The cancelled record retained its timeline.
- Vehicle Detail showed the ACTIVE vehicle lifecycle separately from current RENTED display and the future next rental. Dashboard showed the real active queue and reserved schedule.
- OPERATIONS could read customer history and rental lists, had no customer edit/create controls, and direct navigation to `/app/rentals/new` redirected to access-denied.
- Rental loading and empty states, and scoped “Không tìm thấy hợp đồng” for an unknown valid ID. Error/retry source follows the installed Next 16 contract and was independently reviewed; no deliberate API outage was introduced during final browser QA.
- Rental profile at **1440, 768 and 390px**: document content width matched the viewport at each size, with no whole-page horizontal overflow. Return was completed from the mobile layout.

Evidence: [wizard review](stage-4-screenshots/rental-wizard-review-1440.png), [reserved](stage-4-screenshots/rental-reserved-1440.png), [active desktop](stage-4-screenshots/rental-active-1440.png), [tablet](stage-4-screenshots/rental-active-768.png), [mobile](stage-4-screenshots/rental-active-390.png), [completed](stage-4-screenshots/rental-completed-1440.png), [draft edit](stage-4-screenshots/rental-draft-edit-1440.png), [cancelled](stage-4-screenshots/rental-cancelled-1440.png), [customer history](stage-4-screenshots/customer-history-1440.png), [Operations read-only](stage-4-screenshots/customer-operations-readonly-1440.png), [access denied](stage-4-screenshots/operations-create-denied-1440.png), [not found](stage-4-screenshots/rental-not-found-1440.png), [empty list](stage-4-screenshots/rentals-empty-1440.png), [Vehicle current rental](stage-4-screenshots/vehicle-rented-1440.png), [next rental](stage-4-screenshots/vehicle-next-rental-1440.png), [dashboard active queue](stage-4-screenshots/dashboard-active-1440.png), [reserved schedule](stage-4-screenshots/dashboard-schedule-1440.png).

## Cleanup and process ownership

Browser QA created exactly **1 vehicle, 1 customer and 2 rentals** in the existing development tenant. A TLS-verified cleanup transaction locked that tenant, checked the exact IDs/plate/customer identity, required COMPLETED/CANCELLED states and validated odometers/amounts, then deleted only those four disposable records. A subsequent read confirmed zero matching QA domain rows. All **13 audit events** were retained unchanged. E2E cleanup independently removes only the suite-owned IDs and preserves its audit evidence.

Temporary owned processes were tracked and stopped: initial API session `77246` / PID `27154` on 3101, initial production web session `4177` / PID `27167` on 3100; resumed web session `94650` / PID `28687`; final API session `17325` / PID `28849` on 3211 and final production web session `85902` / PID `28857` on 3100. The attempted API restart PID `28712` exited immediately because an unrelated application owned 3101. Final process checks confirmed every listed owned PID had exited and ports 3100/3211 had no listeners. User-owned processes were left alone. The temporary browser tab was closed and its viewport override reset.

## Scope

Live scope: Customer registry; Rental canonical lifecycle; date-based availability, derived overdue, handover/return odometers; basic rental/deposit fields; tenant/RBAC/audit/contracts/UI. There is no payment/refund ledger, advanced pricing, GPS ingestion/live map, Trip/Toll/Commercial/accounting or global Superadmin API in this stage.
