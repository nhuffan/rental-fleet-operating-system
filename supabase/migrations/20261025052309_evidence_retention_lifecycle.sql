-- Mutable lifecycle state is separate from immutable Stage 14/15 evidence.
-- Binary removal uses the Storage API; this migration never mutates Storage.
alter table public.rentals add constraint rentals_retention_identity_unique unique (business_id, id);
alter table public.inspection_evidence add constraint inspection_evidence_retention_identity_unique unique (business_id, id, rental_id);

create table public.evidence_retention_settings (
  business_id uuid primary key references public.businesses(id) on delete restrict,
  retention_days integer not null default 30,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint evidence_retention_settings_days_check check (retention_days in (30, 90)),
  constraint evidence_retention_settings_time_check check (isfinite(updated_at))
);

create table public.evidence_rental_holds (
  business_id uuid not null references public.businesses(id) on delete restrict,
  rental_id uuid not null,
  active boolean not null default false,
  unresolved_dispute boolean not null default false,
  reason text not null,
  actor_id uuid not null,
  changed_at timestamptz not null default now(),
  primary key (business_id, rental_id),
  constraint evidence_rental_holds_rental_tenant_fk foreign key (business_id, rental_id)
    references public.rentals(business_id, id) on delete restrict,
  constraint evidence_rental_holds_reason_check check (length(reason) between 1 and 2000 and reason !~ '^[[:space:]]*$'),
  constraint evidence_rental_holds_dispute_check check (not unresolved_dispute or active),
  constraint evidence_rental_holds_time_check check (isfinite(changed_at))
);
create index evidence_rental_holds_active on public.evidence_rental_holds (business_id, rental_id) where active;

create table public.evidence_lifecycles (
  evidence_id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete restrict,
  rental_id uuid not null,
  status text not null default 'ACTIVE',
  important boolean not null default false,
  important_reason text,
  important_by uuid,
  important_at timestamptz,
  lease_id uuid,
  lease_until timestamptz,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  last_error_code text,
  purged_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint evidence_lifecycles_evidence_tenant_fk foreign key (business_id, evidence_id, rental_id)
    references public.inspection_evidence(business_id, id, rental_id) on delete restrict,
  constraint evidence_lifecycles_status_check check (status in ('ACTIVE', 'PURGE_ELIGIBLE', 'PURGING', 'PURGED', 'RETRY_REQUIRED')),
  constraint evidence_lifecycles_important_check check (
    (important_reason is null or (length(important_reason) between 1 and 2000 and important_reason !~ '^[[:space:]]*$')) and
    (not important or (important_reason is not null and important_by is not null and important_at is not null))
  ),
  constraint evidence_lifecycles_lease_check check (
    (status = 'PURGING' and lease_id is not null and lease_until is not null) or
    (status <> 'PURGING' and lease_id is null and lease_until is null)
  ),
  constraint evidence_lifecycles_retry_check check (retry_count between 0 and 1000 and
    (last_error_code is null or last_error_code ~ '^[A-Z][A-Z0-9_]{0,63}$')),
  constraint evidence_lifecycles_tombstone_check check (
    (status = 'PURGED' and purged_at is not null and not important and next_retry_at is null and last_error_code is null) or
    (status <> 'PURGED' and purged_at is null)
  ),
  constraint evidence_lifecycles_time_check check (
    isfinite(updated_at) and (important_at is null or isfinite(important_at)) and
    (lease_until is null or isfinite(lease_until)) and (next_retry_at is null or isfinite(next_retry_at)) and
    (purged_at is null or isfinite(purged_at))
  )
);
create index evidence_lifecycles_tenant_rental on public.evidence_lifecycles (business_id, rental_id, evidence_id);
create index evidence_lifecycles_cleanup on public.evidence_lifecycles (status, next_retry_at, lease_until, evidence_id) where status <> 'PURGED';

create table public.evidence_retention_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  rental_id uuid,
  evidence_id uuid,
  action text not null,
  actor_id uuid,
  reason text,
  created_at timestamptz not null default now(),
  constraint evidence_retention_events_rental_tenant_fk foreign key (business_id, rental_id)
    references public.rentals(business_id, id) on delete restrict,
  constraint evidence_retention_events_evidence_tenant_fk foreign key (business_id, evidence_id, rental_id)
    references public.inspection_evidence(business_id, id, rental_id) on delete restrict,
  constraint evidence_retention_events_evidence_check check (evidence_id is null or rental_id is not null),
  constraint evidence_retention_events_action_check check (action in (
    'POLICY_UPDATED', 'IMPORTANT_SET', 'IMPORTANT_RELEASED', 'LEGAL_HOLD_SET', 'LEGAL_HOLD_RELEASED',
    'PURGE_ELIGIBLE', 'PURGE_CLAIMED', 'PURGED', 'PURGE_RETRY', 'PURGE_CANCELLED'
  )),
  constraint evidence_retention_events_reason_check check (
    (reason is null or (length(reason) between 1 and 2000 and reason !~ '^[[:space:]]*$')) and
    (action not in ('IMPORTANT_SET', 'IMPORTANT_RELEASED', 'LEGAL_HOLD_SET', 'LEGAL_HOLD_RELEASED') or
      (reason is not null and actor_id is not null))
  ),
  constraint evidence_retention_events_time_check check (isfinite(created_at))
);
create index evidence_retention_events_business_created on public.evidence_retention_events (business_id, created_at desc, id);
create index evidence_retention_events_rental on public.evidence_retention_events (business_id, rental_id, created_at, id);
create index evidence_retention_events_evidence on public.evidence_retention_events (business_id, evidence_id, rental_id);

create function public.initialize_evidence_lifecycle() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.evidence_lifecycles(evidence_id, business_id, rental_id)
  values (new.id, new.business_id, new.rental_id);
  return new;
end
$$;
revoke all on function public.initialize_evidence_lifecycle() from PUBLIC, anon, authenticated;
create trigger inspection_evidence_initialize_lifecycle after insert on public.inspection_evidence
  for each row execute function public.initialize_evidence_lifecycle();
insert into public.evidence_lifecycles(evidence_id, business_id, rental_id)
select id, business_id, rental_id from public.inspection_evidence;

create function public.protect_evidence_lifecycle_tombstone() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' or old.status = 'PURGED' then
    raise exception using errcode = '23001', constraint = 'evidence_lifecycle_immutable',
      message = 'Evidence lifecycle tombstones cannot be removed or changed';
  end if;
  if new.evidence_id <> old.evidence_id or new.business_id <> old.business_id or new.rental_id <> old.rental_id then
    raise exception using errcode = '23001', constraint = 'evidence_lifecycle_identity_immutable',
      message = 'Evidence lifecycle identity is immutable';
  end if;
  return new;
end
$$;
revoke all on function public.protect_evidence_lifecycle_tombstone() from PUBLIC, anon, authenticated;
create trigger evidence_lifecycles_protect_tombstone before update or delete on public.evidence_lifecycles
  for each row execute function public.protect_evidence_lifecycle_tombstone();

create function public.prevent_evidence_retention_event_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '23001', constraint = 'evidence_retention_events_immutable',
    message = 'Evidence retention history is immutable';
end
$$;
revoke all on function public.prevent_evidence_retention_event_mutation() from PUBLIC, anon, authenticated;
create trigger evidence_retention_events_immutable before update or delete on public.evidence_retention_events
  for each row execute function public.prevent_evidence_retention_event_mutation();

alter table public.evidence_retention_settings enable row level security;
alter table public.evidence_rental_holds enable row level security;
alter table public.evidence_lifecycles enable row level security;
alter table public.evidence_retention_events enable row level security;
revoke all on public.evidence_retention_settings, public.evidence_rental_holds, public.evidence_lifecycles, public.evidence_retention_events from PUBLIC, anon, authenticated;
grant select on public.evidence_retention_settings, public.evidence_rental_holds, public.evidence_lifecycles, public.evidence_retention_events to authenticated;
create policy evidence_retention_settings_owner on public.evidence_retention_settings for select to authenticated using (
  exists (select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id
    join public.user_profiles p on p.user_id=m.user_id where b.id=evidence_retention_settings.business_id
      and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE')
);
create policy evidence_rental_holds_owner on public.evidence_rental_holds for select to authenticated using (
  exists (select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id
    join public.user_profiles p on p.user_id=m.user_id where b.id=evidence_rental_holds.business_id
      and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE')
);
create policy evidence_lifecycles_owner on public.evidence_lifecycles for select to authenticated using (
  exists (select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id
    join public.user_profiles p on p.user_id=m.user_id where b.id=evidence_lifecycles.business_id
      and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE')
);
create policy evidence_retention_events_owner on public.evidence_retention_events for select to authenticated using (
  exists (select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id
    join public.user_profiles p on p.user_id=m.user_id where b.id=evidence_retention_events.business_id
      and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE')
);
