-- Vehicle compliance dates (registration, insurance, next maintenance) are optional
-- vehicle attributes. Service records are append-only, tenant-scoped history written by
-- NestJS under the business lock with the redacted audit event. Costs here are recorded
-- facts only: they never create a Commercial movement.
alter table public.vehicles
  add column registration_expires_on date,
  add column insurance_expires_on date,
  add column next_maintenance_on date,
  add column next_maintenance_odometer integer,
  add constraint vehicles_registration_expiry_check check (
    registration_expires_on is null or registration_expires_on between date '2000-01-01' and date '2100-12-31'
  ),
  add constraint vehicles_insurance_expiry_check check (
    insurance_expires_on is null or insurance_expires_on between date '2000-01-01' and date '2100-12-31'
  ),
  add constraint vehicles_next_maintenance_check check (
    next_maintenance_on is null or next_maintenance_on between date '2000-01-01' and date '2100-12-31'
  ),
  add constraint vehicles_next_maintenance_odometer_check check (
    next_maintenance_odometer is null or next_maintenance_odometer between 0 and 2147483647
  );

create table public.vehicle_service_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  vehicle_id uuid not null,
  kind text not null,
  performed_on date not null,
  odometer integer,
  cost_vnd numeric(18, 0),
  notes text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint vehicle_service_records_vehicle_tenant_fk foreign key (business_id, vehicle_id)
    references public.vehicles(business_id, id) on delete restrict,
  constraint vehicle_service_records_kind_check check (kind in ('MAINTENANCE', 'REGISTRATION', 'INSURANCE')),
  constraint vehicle_service_records_date_check check (performed_on between date '2000-01-01' and date '2100-12-31'),
  constraint vehicle_service_records_odometer_check check (odometer is null or odometer between 0 and 2147483647),
  constraint vehicle_service_records_cost_check check (cost_vnd is null or (cost_vnd >= 0 and cost_vnd <= 999999999999999)),
  constraint vehicle_service_records_notes_check check (length(notes) <= 2000 and notes = trim(notes))
);
create index vehicle_service_records_vehicle_history on public.vehicle_service_records
  (business_id, vehicle_id, performed_on desc, id desc);

create function public.prevent_vehicle_service_record_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '23001', constraint = 'vehicle_service_records_immutable',
    message = 'Vehicle service records are immutable';
end
$$;
revoke all on function public.prevent_vehicle_service_record_mutation() from PUBLIC, anon, authenticated;
create trigger vehicle_service_records_immutable before update or delete on public.vehicle_service_records
  for each row execute function public.prevent_vehicle_service_record_mutation();

alter table public.vehicle_service_records enable row level security;
revoke all on public.vehicle_service_records from PUBLIC, anon, authenticated;
grant select on public.vehicle_service_records to authenticated;
create policy vehicle_service_records_owner on public.vehicle_service_records for select to authenticated using (
  exists (
    select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = vehicle_service_records.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
      and m.role_key = 'OWNER' and p.status = 'ACTIVE'
  )
);
