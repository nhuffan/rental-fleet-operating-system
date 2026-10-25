-- CSV statements are normalized operational sources, never an alternative ledger.
-- Original statement bytes are not persisted. Historical actors survive Auth removal.
create table public.toll_import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  source text not null,
  idempotency_key uuid not null,
  content_hash text not null,
  row_count integer not null,
  imported_count integer not null,
  duplicate_count integer not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint toll_import_batches_tenant_identity unique(business_id,id),
  constraint toll_import_batches_source_identity unique(business_id,id,source),
  constraint toll_import_batches_idempotency unique(business_id,idempotency_key),
  constraint toll_import_batches_source_check check(length(source) between 1 and 80 and source !~ '^[[:space:]]*$'),
  constraint toll_import_batches_hash_check check(content_hash ~ '^[a-f0-9]{64}$'),
  constraint toll_import_batches_counts_check check(row_count between 1 and 200 and imported_count>=0 and duplicate_count>=0 and imported_count+duplicate_count=row_count),
  constraint toll_import_batches_time_check check(isfinite(created_at))
);
create index toll_import_batches_business_created on public.toll_import_batches(business_id,created_at desc,id);

create table public.toll_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  batch_id uuid not null,
  source text not null,
  external_reference text not null default '',
  fingerprint text not null,
  plate text not null,
  occurred_at timestamptz not null,
  amount numeric(18,0) not null,
  station text not null default '',
  description text not null default '',
  import_row integer not null,
  status text not null default 'UNMATCHED',
  vehicle_id uuid,
  rental_id uuid,
  movement_id uuid,
  review_reason text not null default '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint toll_transactions_tenant_identity unique(business_id,id),
  constraint toll_transactions_batch_tenant_fk foreign key(business_id,batch_id,source) references public.toll_import_batches(business_id,id,source) on delete restrict,
  constraint toll_transactions_vehicle_tenant_fk foreign key(business_id,vehicle_id) references public.vehicles(business_id,id) on delete restrict,
  constraint toll_transactions_rental_tenant_fk foreign key(business_id,rental_id,vehicle_id) references public.rentals(business_id,id,vehicle_id) on delete restrict,
  constraint toll_transactions_movement_tenant_fk foreign key(business_id,movement_id) references public.commercial_movements(business_id,id) on delete restrict,
  constraint toll_transactions_source_check check(length(source) between 1 and 80 and source !~ '^[[:space:]]*$'),
  constraint toll_transactions_reference_check check(length(external_reference)<=160),
  constraint toll_transactions_fingerprint_check check(fingerprint ~ '^[a-f0-9]{64}$'),
  constraint toll_transactions_plate_check check(plate ~ '^[A-Z0-9]{4,16}$'),
  constraint toll_transactions_amount_check check(amount>0 and amount<=999999999999999 and amount<>'NaN'::numeric),
  constraint toll_transactions_text_check check(length(station)<=200 and length(description)<=2000 and length(review_reason)<=2000),
  constraint toll_transactions_row_check check(import_row between 2 and 201),
  constraint toll_transactions_status_check check(status in ('UNMATCHED','NEEDS_REVIEW','MATCHED','RECORDED','IGNORED')),
  constraint toll_transactions_scope_check check(rental_id is null or vehicle_id is not null),
  constraint toll_transactions_match_check check(status not in ('MATCHED','RECORDED') or vehicle_id is not null),
  constraint toll_transactions_recorded_check check((status='RECORDED' and movement_id is not null) or (status<>'RECORDED' and movement_id is null)),
  constraint toll_transactions_review_check check(status not in ('MATCHED','RECORDED','IGNORED') or (reviewed_by is not null and reviewed_at is not null and review_reason !~ '^[[:space:]]*$')),
  constraint toll_transactions_version_check check(version>=1),
  constraint toll_transactions_time_check check(isfinite(occurred_at) and isfinite(created_at) and isfinite(updated_at) and (reviewed_at is null or isfinite(reviewed_at)))
);
create unique index toll_transactions_external_unique on public.toll_transactions(business_id,source,external_reference) where external_reference<>'';
create unique index toll_transactions_fingerprint_unique on public.toll_transactions(business_id,source,fingerprint) where external_reference='';
create unique index toll_transactions_movement_unique on public.toll_transactions(business_id,movement_id) where movement_id is not null;
create index toll_transactions_business_occurred on public.toll_transactions(business_id,occurred_at desc,id);
create index toll_transactions_business_status on public.toll_transactions(business_id,status,occurred_at desc,id);
create index toll_transactions_vehicle_occurred on public.toll_transactions(business_id,vehicle_id,occurred_at desc,id);
create index toll_transactions_rental on public.toll_transactions(business_id,rental_id,vehicle_id,occurred_at desc,id);
create index toll_transactions_batch on public.toll_transactions(business_id,batch_id,id);
create index toll_transactions_fingerprint on public.toll_transactions(business_id,source,fingerprint);

create table public.toll_review_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  toll_transaction_id uuid not null,
  action text not null,
  vehicle_id uuid,
  rental_id uuid,
  status text not null,
  version integer not null,
  actor_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint toll_review_events_transaction_tenant_fk foreign key(business_id,toll_transaction_id) references public.toll_transactions(business_id,id) on delete restrict,
  constraint toll_review_events_vehicle_tenant_fk foreign key(business_id,vehicle_id) references public.vehicles(business_id,id) on delete restrict,
  constraint toll_review_events_rental_tenant_fk foreign key(business_id,rental_id,vehicle_id) references public.rentals(business_id,id,vehicle_id) on delete restrict,
  constraint toll_review_events_scope_check check(rental_id is null or vehicle_id is not null),
  constraint toll_review_events_status_check check(status in ('UNMATCHED','NEEDS_REVIEW','MATCHED','RECORDED','IGNORED')),
  constraint toll_review_events_version_check check(version>=1),
  constraint toll_review_events_action_check check(action in ('IMPORTED','MATCH_CONFIRMED','IGNORED','RECORDED')),
  constraint toll_review_events_reason_check check(length(reason) between 1 and 2000 and reason !~ '^[[:space:]]*$'),
  constraint toll_review_events_time_check check(isfinite(created_at))
);
create index toll_review_events_rental on public.toll_review_events(business_id,rental_id,vehicle_id);
create index toll_review_events_vehicle on public.toll_review_events(business_id,vehicle_id);
create index toll_review_events_transaction on public.toll_review_events(business_id,toll_transaction_id,created_at,id);

create function public.prevent_toll_import_mutation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  raise exception using errcode='23001',constraint='toll_import_immutable',message='Imported toll provenance and history are immutable';
end $$;
revoke all on function public.prevent_toll_import_mutation() from PUBLIC,anon,authenticated;
create trigger toll_import_batches_immutable before update or delete on public.toll_import_batches for each row execute function public.prevent_toll_import_mutation();
create trigger toll_review_events_immutable before update or delete on public.toll_review_events for each row execute function public.prevent_toll_import_mutation();

create function public.protect_toll_transaction_provenance() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    raise exception using errcode='23001',constraint='toll_transaction_immutable',message='Imported toll provenance cannot be removed';
  end if;
  if tg_op='UPDATE' then
    if old.status='RECORDED' then
      raise exception using errcode='23001',constraint='toll_transaction_immutable',message='Recorded tolls cannot be changed';
    end if;
    if (new.id,new.business_id,new.batch_id,new.source,new.external_reference,new.fingerprint,new.plate,new.occurred_at,new.amount,new.station,new.description,new.import_row,new.created_at)
      is distinct from (old.id,old.business_id,old.batch_id,old.source,old.external_reference,old.fingerprint,old.plate,old.occurred_at,old.amount,old.station,old.description,old.import_row,old.created_at) then
      raise exception using errcode='23001',constraint='toll_transaction_provenance_immutable',message='Imported toll provenance is immutable';
    end if;
  end if;
  if new.status='RECORDED' and not exists(
    select 1 from public.commercial_movements m where m.business_id=new.business_id and m.id=new.movement_id
      and m.kind='EXPENSE' and m.category='TOLL' and m.reversal_of is null
      and m.amount=new.amount and m.occurred_at=new.occurred_at
      and m.vehicle_id is not distinct from new.vehicle_id and m.rental_id is not distinct from new.rental_id
  ) then
    raise exception using errcode='23514',constraint='toll_transaction_movement_matches',message='Recorded toll must reference its matching original toll expense';
  end if;
  return new;
end $$;
revoke all on function public.protect_toll_transaction_provenance() from PUBLIC,anon,authenticated;
create trigger toll_transactions_protect_provenance before insert or update or delete on public.toll_transactions for each row execute function public.protect_toll_transaction_provenance();

alter table public.toll_import_batches enable row level security;
alter table public.toll_transactions enable row level security;
alter table public.toll_review_events enable row level security;
revoke all on public.toll_import_batches,public.toll_transactions,public.toll_review_events from PUBLIC,anon,authenticated;
grant select on public.toll_import_batches,public.toll_transactions,public.toll_review_events to authenticated;
create policy toll_import_batches_owner on public.toll_import_batches for select to authenticated using(exists(
 select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id join public.user_profiles p on p.user_id=m.user_id
 where b.id=toll_import_batches.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE'));
create policy toll_transactions_owner on public.toll_transactions for select to authenticated using(exists(
 select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id join public.user_profiles p on p.user_id=m.user_id
 where b.id=toll_transactions.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE'));
create policy toll_review_events_owner on public.toll_review_events for select to authenticated using(exists(
 select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id join public.user_profiles p on p.user_id=m.user_id
 where b.id=toll_review_events.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE'));
