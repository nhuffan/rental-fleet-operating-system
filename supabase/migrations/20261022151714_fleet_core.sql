-- Fleet records belong to a business. Canonical identifiers and tenant foreign keys
-- remain database invariants even when writes bypass the application query layer.
alter table public.branches
  add constraint branches_business_id_id_unique unique (business_id, id);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid,
  license_plate text not null,
  make text not null,
  model text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_license_plate_check check (license_plate ~ '^[A-Z0-9]{4,16}$'),
  constraint vehicles_make_check check (length(trim(make)) between 1 and 80),
  constraint vehicles_model_check check (length(trim(model)) between 1 and 80),
  constraint vehicles_status_check check (status in ('ACTIVE', 'INACTIVE')),
  constraint vehicles_business_plate_unique unique (business_id, license_plate),
  constraint vehicles_business_id_id_unique unique (business_id, id),
  constraint vehicles_branch_tenant_fk foreign key (business_id, branch_id)
    references public.branches(business_id, id) on delete restrict
);
create index vehicles_business_created on public.vehicles(business_id, created_at desc, id);
create index vehicles_business_branch on public.vehicles(business_id, branch_id);

create table public.gps_devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  provider text not null,
  device_uid text not null,
  label text not null default '',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gps_devices_provider_check check (provider ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  constraint gps_devices_uid_check check (device_uid ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$'),
  constraint gps_devices_label_check check (length(label) <= 120),
  constraint gps_devices_status_check check (status in ('ACTIVE', 'INACTIVE')),
  -- Provider + UID identifies one registry record globally; ownership is never transferred by the API.
  constraint gps_devices_provider_uid_unique unique (provider, device_uid),
  constraint gps_devices_business_id_id_unique unique (business_id, id)
);
create index gps_devices_business_created on public.gps_devices(business_id, created_at desc, id);

create table public.device_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  vehicle_id uuid not null,
  device_id uuid not null,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  constraint device_assignments_vehicle_tenant_fk foreign key (business_id, vehicle_id)
    references public.vehicles(business_id, id) on delete restrict,
  constraint device_assignments_device_tenant_fk foreign key (business_id, device_id)
    references public.gps_devices(business_id, id) on delete restrict,
  constraint device_assignments_time_check check (unassigned_at is null or unassigned_at >= assigned_at)
);
-- One current primary GPS per vehicle and one vehicle per GPS, including concurrent inserts.
create unique index device_assignments_active_vehicle_unique
  on public.device_assignments(vehicle_id) where unassigned_at is null;
create unique index device_assignments_active_device_unique
  on public.device_assignments(device_id) where unassigned_at is null;
create index device_assignments_vehicle_history
  on public.device_assignments(business_id, vehicle_id, assigned_at desc, id);
create index device_assignments_device_history
  on public.device_assignments(business_id, device_id, assigned_at desc, id);

alter table public.vehicles enable row level security;
alter table public.gps_devices enable row level security;
alter table public.device_assignments enable row level security;
revoke all on public.vehicles, public.gps_devices, public.device_assignments from anon, authenticated;
grant select on public.vehicles, public.gps_devices, public.device_assignments to authenticated;
-- No direct writes or SECURITY DEFINER helpers. An active profile, membership and business are required.
create policy vehicles_member on public.vehicles for select to authenticated using (
  exists (select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = vehicles.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and p.status = 'ACTIVE')
);
create policy gps_devices_member on public.gps_devices for select to authenticated using (
  exists (select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = gps_devices.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and p.status = 'ACTIVE')
);
create policy device_assignments_member on public.device_assignments for select to authenticated using (
  exists (select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = device_assignments.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and p.status = 'ACTIVE')
);
