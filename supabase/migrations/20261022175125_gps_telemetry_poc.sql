-- Current-state equivalent: latest position of the CURRENT assignment, selected using
-- gps_positions_assignment_latest. Arrival order cannot move current state backwards.
alter table public.device_assignments add constraint device_assignments_identity_unique
  unique (business_id, id, device_id, vehicle_id);
create table public.gps_positions (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 assignment_id uuid not null, device_id uuid not null, vehicle_id uuid not null,
 provider text not null check (provider = 'traccar'),
 device_uid text not null check (length(device_uid) between 1 and 128),
 event_key text not null check (length(event_key) = 64),
 source_event_id text,
 recorded_at timestamptz not null check (isfinite(recorded_at)),
 received_at timestamptz not null default clock_timestamp() check (isfinite(received_at)),
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 speed_kph double precision not null check (speed_kph between 0 and 600),
 heading double precision not null check (heading >= 0 and heading < 360),
 ignition boolean,
 source_mode text not null default 'TEST' check (source_mode = 'TEST'),
 constraint gps_positions_assignment_tenant_fk foreign key (business_id,assignment_id,device_id,vehicle_id)
 references public.device_assignments(business_id,id,device_id,vehicle_id) on delete restrict,
 constraint gps_positions_event_unique unique (device_id,event_key)
);
create index gps_positions_assignment_latest on public.gps_positions(business_id,assignment_id,recorded_at desc,id desc);
create index gps_positions_device_time on public.gps_positions(business_id,device_id,recorded_at desc);
create index gps_positions_vehicle_time on public.gps_positions(business_id,vehicle_id,recorded_at desc);
create index gps_positions_retention on public.gps_positions(received_at,id);
alter table public.gps_positions enable row level security;
-- Location/history is sensitive: Data API access denied, including authenticated.
-- Only the API's tenant-authorized read projection is exposed, never all telemetry.
revoke all on public.gps_positions from anon, authenticated;
