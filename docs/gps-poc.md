# GPS proof of concept

This stage connects a **Traccar TEST feed** through a real decoder, authenticated API ingestion, PostgreSQL storage and the live Fleet Map. Every stored point has server-fixed `sourceMode: TEST`; input cannot promote it to REAL. The coordinates sent by the reusable feed are synthetic. This does not verify a physical tracker, a deployed provider connection or production readiness. Historical synthetic design fixtures remain confined to development previews.

## Ingestion and canonical data

`POST /api/v1/integrations/traccar/positions` accepts the Traccar JSON forwarding envelope (`device` and `position`). Configure `GPS_TRACCAR_TOKEN` in the ignored API env file with a random value of at least 32 characters. Traccar supplies it in `X-Traccar-Token`; comparison uses constant-time hashes. A missing/short server token disables ingestion with `GPS_NOT_CONFIGURED`; a missing/incorrect request token returns `INVALID_GPS_TOKEN`. This trusted webhook uses its own credential, separate from Supabase user sessions. Keep the token server-only, outside browser env, source control and logs.

The adapter maps only these canonical fields; it does not persist the raw provider packet:

| Canonical field | Origin / rule |
| --- | --- |
| `provider`, `deviceUid` | Fixed `traccar`; validated `device.uniqueId`, case-sensitive |
| `recordedAt` | `position.fixTime`, strict timezone-qualified ISO date |
| `receivedAt` | PostgreSQL `clock_timestamp()` on first insert |
| `latitude`, `longitude` | Finite numeric degrees, latitude −90…90 and longitude −180…180 |
| `speedKph` | Traccar `position.speed` in knots × 1.852; finite 0…600 km/h |
| `heading` | `position.course`, finite 0 ≤ degrees < 360 |
| `ignition` | Boolean `position.attributes.ignition`, or null when absent |
| `sourceEventId` | Positive safe integer `position.id`, retained as optional diagnostic metadata |
| `eventKey` | SHA-256 of UID, fix time, coordinates, normalized speed, heading and ignition |
| `sourceMode` | Fixed `TEST` in the adapter and constrained in PostgreSQL |

Only `position.valid === true` is accepted. Invalid types, coordinates, speed, heading or ignition return `INVALID_TELEMETRY`. Fix times more than five minutes ahead of the database clock, or more than 30 days old, return `GPS_TIME_OUTSIDE_WINDOW`.

The global immutable registry identity `(provider, deviceUid)` resolves the business; incoming business/vehicle IDs are never trusted. Ingestion takes the same business-row lock as Fleet assignment/end/disable operations, then checks the business and device are active. It resolves exactly one historical assignment containing `recordedAt` in `[assignedAt, unassignedAt)`, including an ended assignment for a delayed event. Unknown/inactive devices or unresolved/ambiguous assignments are rejected with structured GPS error codes. The composite foreign key `(businessId, assignmentId, deviceId, vehicleId)` prevents mixed-tenant history.

Uniqueness of `(deviceId, eventKey)` makes semantic retransmissions idempotent. Traccar's memory-store IDs restart, so `sourceEventId` is not the deduplication key. A duplicate returns the original `positionId` and `duplicate: true` without changing its first `receivedAt`.

## Current location and authorization

There is no arrival-time overwrite of a mutable location row. The indexed current-state equivalent selects the latest point of the **current assignment**, ordered by `recordedAt DESC, receivedAt ASC, id ASC`. Older delayed packets enter history without moving the displayed fix backwards. Equal fix timestamps retain the first successfully received point. Ending/replacing an assignment immediately hides its points from the current projection; old points remain history for that historical assignment.

`gps_positions_assignment_latest` supports this bounded latest-point lookup. Separate device/time, vehicle/time and retention indexes support the remaining access paths. The browser receives a current projection, never a full telemetry history download.

| API | Behavior |
| --- | --- |
| `GET /api/v1/vehicles/:id/location` | One tenant-scoped vehicle, current device, GPS state and nullable location; 404 for an inaccessible vehicle |
| `GET /api/v1/fleet/locations` | Paginated current locations; `page` defaults to 1, `limit` to 20 and is capped at 100; optional `search` and `state` filters |

Both reads require a valid Supabase user, active profile/business/membership and `gps.read`. Every query includes the verified business ID. An active rental ID is included only when the role also has `rental.read`. Fleet statistics cover the tenant; `total` counts vehicles matching the list filters. Pages use stable license-plate/vehicle-ID ordering and return `asOf` plus `pollAfterSeconds: 20`.

`gps_positions` has RLS enabled and all privileges revoked from `anon` and `authenticated`, including reads. Its coordinates/history are available only through the API's authorized projection and trusted database connection. Registry permission and assignment alone do not establish a GPS signal.

Freshness derives from `recordedAt` against the server clock at each read:

| State | Meaning |
| --- | --- |
| `UNASSIGNED` | No current device assignment |
| `NO_DATA` | Current assignment has no accepted point |
| `FRESH` | Fix age ≤120 seconds |
| `STALE` | Fix age >120 and ≤600 seconds |
| `OFFLINE` | Fix age >600 seconds; last-known coordinates can remain visible |

## Live map

`/app/fleet-map` and the dashboard location panel use the authorized GPS API and visibly label **TEST FEED**. Vehicle Detail displays the current assignment's last-known point and separate recorded/received times. The map lists/plots only its current page of 20 vehicles; selecting a marker or row reveals coordinates, timestamps, vehicle navigation and the current rental link when permitted. No-data states remain explicit.

The client polls every 20 seconds after a request completes, aborts pending work and pauses while the document is hidden, then refreshes when visible. Unmount/filter/tenant changes cancel obsolete requests. A failed refresh keeps the last successful response with a warning and its load time; it does not claim that stale cached status is current. Vehicle Detail updates on a page reload.

Leaflet 1.9.4 loads in the browser. The map uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible OpenStreetMap attribution; no map token is needed. A tile failure leaves the vehicle list and coordinates usable. Public OSM tiles are best-effort and have a usage policy: keep attribution, browser Referer and HTTP caching behavior, and do not bulk download or prefetch. A higher-volume deployment needs an appropriate tile-service arrangement.

## Reproduce the TEST feed

Use only development project `eeryymswcufnebibigqf`, with migrated schema, Docker running, the API on `127.0.0.1:3001`, and a server-only `GPS_TRACCAR_TOKEN` configured. Through the normal Fleet UI/API, register a device with provider `traccar` and a unique UID beginning `TEST-`, then assign it to a disposable development vehicle. From the repository root:

```sh
pnpm --filter api gps:poc --uid=TEST-your-unique-device
```

The script refuses any other environment/project and requires exactly one active assignment. It launches a uniquely named, temporary official Traccar 6.16.0 container pinned to a digest, with an in-memory store, OsmAnd only and a loopback bind on port **5055**. The temporary XML config contains the header token and is created with mode 0600. The script does not print it. A port conflict fails rather than reusing/stopping another container.

On macOS Docker Desktop, forwarding uses `host.docker.internal:3001` to reach the host API. If canonical verification fails, check that routing and the API/token configuration. This is a local Docker Desktop workflow; no remote provider listener is deployed.

The script sends synthetic OsmAnd HTTP packets to port 5055, which Traccar decodes and forwards as JSON to the trusted webhook. It sends a duplicate and, when the assignment interval allows it, a delayed fix. It verifies stored canonical values (12 knots →22.224 km/h), deduplication and preservation of the newer fix, then prints non-secret JSON evidence. It removes its own container and temporary config through idempotent cleanup on completion, failure, SIGINT and SIGTERM. Verification isolates the current run’s timestamps so repeated runs can reuse the same TEST UID. Stored points remain attached to the chosen development assignment; remove only owned disposable records when cleaning up a QA run. No live device is simulated as REAL.

The gateway setup follows official [Traccar position forwarding](https://www.traccar.org/forward/) and [forwarder-only configuration](https://www.traccar.org/forwarder-only/). The speed unit is defined in the pinned [Traccar Position model](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/model/Position.java). Map behavior follows the [Leaflet reference](https://leafletjs.com/reference.html) and [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

## History retention

History expires **30 days after `receivedAt`**, except that the latest point of each active assignment is retained as its last-known location, even when offline for more than 30 days. An ended assignment has no such exception. This differs from the ingestion acceptance window, which checks the age of `recordedAt`.

Retention is an explicit development-only maintenance command, restricted to `eeryymswcufnebibigqf` and one supplied tenant UUID. It examines/removes at most 1,000 eligible rows per invocation and defaults to a dry run:

```sh
pnpm --filter api gps:retention --business=<verified-tenant-uuid>
pnpm --filter api gps:retention --business=<verified-tenant-uuid> --apply
```

Review the dry-run count, then apply and repeat bounded batches as necessary. There is no automatic production retention scheduler in this PoC. Durable provider deployment, physical device verification, credential rotation/rate limiting, monitoring, production retention scheduling and production map capacity remain further work. Verification evidence for this implementation batch belongs in `STAGE_OUTPUT.md`.
