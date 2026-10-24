-- Each lifecycle milestone owns one immutable, tenant-scoped inspection snapshot.
-- Attribution intentionally has no actor/profile FK: historical IDs must survive
-- identity deletion. NestJS rechecks the active Owner and writes the inspection,
-- lifecycle transition and audit entry atomically under the existing business lock.
create table public.rental_inspections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  rental_id uuid not null,
  vehicle_id uuid not null,
  type text not null,
  actor_id uuid not null,
  recorded_at timestamptz not null default now(),
  odometer integer not null,
  fuel_percent integer not null,
  exterior_condition text not null,
  interior_condition text not null,
  spare_tire text not null,
  tools text not null,
  registration_document text not null,
  insurance_document text not null,
  keys text not null,
  damage_notes text not null default '',
  notes text not null default '',
  constraint rental_inspections_rental_tenant_fk foreign key (business_id, rental_id, vehicle_id)
    references public.rentals(business_id, id, vehicle_id) on delete restrict,
  constraint rental_inspections_rental_type_unique unique (business_id, rental_id, type),
  constraint rental_inspections_type_check check (type in ('HANDOVER', 'RETURN')),
  constraint rental_inspections_time_check check (isfinite(recorded_at)),
  constraint rental_inspections_odometer_check check (odometer between 0 and 2147483647),
  constraint rental_inspections_fuel_check check (fuel_percent between 0 and 100),
  constraint rental_inspections_condition_check check (
    exterior_condition in ('GOOD', 'DAMAGED') and interior_condition in ('GOOD', 'DAMAGED')
  ),
  constraint rental_inspections_checklist_check check (
    spare_tire in ('PRESENT', 'MISSING', 'NOT_APPLICABLE') and
    tools in ('PRESENT', 'MISSING', 'NOT_APPLICABLE') and
    registration_document in ('PRESENT', 'MISSING', 'NOT_APPLICABLE') and
    insurance_document in ('PRESENT', 'MISSING', 'NOT_APPLICABLE') and
    keys in ('PRESENT', 'MISSING', 'NOT_APPLICABLE')
  ),
  constraint rental_inspections_notes_check check (length(notes) <= 2000 and length(damage_notes) <= 2000),
  constraint rental_inspections_damage_notes_check check (
    (exterior_condition <> 'DAMAGED' and interior_condition <> 'DAMAGED') or
    damage_notes !~ '^[[:space:]]*$'
  )
);
-- The rental/type unique index supports detail reads and the leading FK columns;
-- vehicle history uses the latest recorded milestone with a stable UUID tie-break.
create index rental_inspections_vehicle_recorded on public.rental_inspections
  (business_id, vehicle_id, recorded_at desc, id desc);

create function public.prevent_rental_inspection_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '23001', constraint = 'rental_inspections_immutable',
    message = 'Inspection snapshots are immutable';
end
$$;
revoke all on function public.prevent_rental_inspection_mutation() from PUBLIC, anon, authenticated;
create trigger rental_inspections_immutable before update or delete on public.rental_inspections
  for each row execute function public.prevent_rental_inspection_mutation();

alter table public.rental_inspections enable row level security;
revoke all on public.rental_inspections from PUBLIC, anon, authenticated;
grant select on public.rental_inspections to authenticated;
create policy rental_inspections_owner on public.rental_inspections for select to authenticated using (
  exists (
    select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = rental_inspections.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
      and m.role_key = 'OWNER' and p.status = 'ACTIVE'
  )
);
