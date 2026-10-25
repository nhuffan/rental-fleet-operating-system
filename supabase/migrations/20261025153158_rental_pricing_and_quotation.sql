-- VND rate configuration; business defaults and individual vehicle scopes are distinct.
create table public.rental_rate_cards (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 vehicle_id uuid,
 name text not null,
 hourly_rate numeric,
 daily_rate numeric,
 minimum_charge numeric not null default 0,
 extra_hour_rate numeric,
 effective_from timestamptz not null,
 effective_until timestamptz,
 status text not null default 'ACTIVE',
 version integer not null default 1,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint rental_rate_cards_tenant_identity unique(business_id,id),
 constraint rental_rate_cards_vehicle_tenant_fk foreign key(business_id,vehicle_id) references public.vehicles(business_id,id) on delete restrict,
 constraint rental_rate_cards_name_check check(length(name) between 1 and 120 and name !~ '^[[:space:]]*$'),
 constraint rental_rate_cards_amount_check check(
  (hourly_rate is null or (hourly_rate>0 and hourly_rate<=999999999 and hourly_rate=trunc(hourly_rate))) and
  (daily_rate is null or (daily_rate>0 and daily_rate<=999999999 and daily_rate=trunc(daily_rate))) and
  (extra_hour_rate is null or (extra_hour_rate>0 and extra_hour_rate<=999999999 and extra_hour_rate=trunc(extra_hour_rate))) and
  minimum_charge>=0 and minimum_charge<=999999999 and minimum_charge=trunc(minimum_charge)
 ),
 constraint rental_rate_cards_configuration_check check((hourly_rate is not null or daily_rate is not null) and (extra_hour_rate is null or daily_rate is not null)),
 constraint rental_rate_cards_time_check check(isfinite(effective_from) and (effective_until is null or (isfinite(effective_until) and effective_until>effective_from)) and isfinite(created_at) and isfinite(updated_at)),
 constraint rental_rate_cards_status_check check(status in ('ACTIVE','INACTIVE')),
 constraint rental_rate_cards_version_check check(version>=1),
 constraint rental_rate_cards_default_overlap exclude using gist (business_id with =,tstzrange(effective_from,effective_until,'[)') with &&) where(status='ACTIVE' and vehicle_id is null),
 constraint rental_rate_cards_vehicle_overlap exclude using gist (business_id with =,vehicle_id with =,tstzrange(effective_from,effective_until,'[)') with &&) where(status='ACTIVE' and vehicle_id is not null)
);
create index rental_rate_cards_business_scope_effective on public.rental_rate_cards(business_id,vehicle_id,effective_from,id);

alter table public.rentals add column pricing_draft jsonb;
alter table public.rentals add constraint rentals_pricing_draft_object_check check(pricing_draft is null or jsonb_typeof(pricing_draft)='object');

create table public.rental_quote_snapshots (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 rental_id uuid not null,
 vehicle_id uuid not null,
 rate_card_id uuid,
 mode text not null,
 breakdown jsonb,
 agreed_amount numeric not null,
 override_reason text,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 constraint rental_quote_snapshots_rental_unique unique(business_id,rental_id),
 constraint rental_quote_snapshots_rental_tenant_fk foreign key(business_id,rental_id,vehicle_id) references public.rentals(business_id,id,vehicle_id) on delete restrict,
 constraint rental_quote_snapshots_rate_tenant_fk foreign key(business_id,rate_card_id) references public.rental_rate_cards(business_id,id) on delete restrict,
 constraint rental_quote_snapshots_mode_check check(mode in ('CALCULATED','OVERRIDE','MANUAL')),
 constraint rental_quote_snapshots_amount_check check(agreed_amount>=0 and agreed_amount<=999999999 and agreed_amount=trunc(agreed_amount)),
 constraint rental_quote_snapshots_reason_check check(
  (mode='CALCULATED' and override_reason is null) or
  (mode in ('OVERRIDE','MANUAL') and override_reason is not null and length(override_reason) between 1 and 2000 and override_reason !~ '^[[:space:]]*$')
 ),
 constraint rental_quote_snapshots_configuration_check check(
  (mode='MANUAL' and breakdown is null and rate_card_id is null) or
  (mode in ('CALCULATED','OVERRIDE') and breakdown is not null and rate_card_id is not null and jsonb_typeof(breakdown)='object')
 ),
 constraint rental_quote_snapshots_time_check check(isfinite(created_at))
);
create index rental_quote_snapshots_rate on public.rental_quote_snapshots(business_id,rate_card_id);

-- A copied quote is history, not a live reference to a card that can later change.
create function public.protect_rental_quote_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.rentals%rowtype; card public.rental_rate_cards%rowtype; line jsonb; line_sum numeric:=0;
begin
 if tg_op<>'INSERT' then
  raise exception using errcode='23001',constraint='rental_quote_snapshots_immutable',message='Confirmed quotation snapshots are immutable';
 end if;
 select * into r from public.rentals where business_id=new.business_id and id=new.rental_id and vehicle_id=new.vehicle_id;
 if not found or r.status='DRAFT' or r.rental_amount<>new.agreed_amount then
  raise exception using errcode='23514',constraint='rental_quote_snapshots_rental_matches',message='Quotation must match a confirmed rental and its agreed amount';
 end if;
 if new.mode in ('CALCULATED','OVERRIDE') then
  select * into card from public.rental_rate_cards where business_id=new.business_id and id=new.rate_card_id;
  if not found or card.status<>'ACTIVE' or (card.vehicle_id is not null and card.vehicle_id<>new.vehicle_id) or
   r.start_at<card.effective_from or (card.effective_until is not null and r.start_at>=card.effective_until) or
   (new.breakdown->>'vehicleId') is distinct from new.vehicle_id::text or
   (new.breakdown->>'rateCardId') is distinct from new.rate_card_id::text or
   (new.breakdown->>'currency') is distinct from 'VND' or
   (new.breakdown->>'timeZone') is distinct from 'Asia/Ho_Chi_Minh' or
   (new.breakdown->>'rateVersion') is distinct from card.version::text or
   (new.breakdown->>'rateName') is distinct from card.name or
   (new.breakdown->>'rateSource') is distinct from (case when card.vehicle_id is null then 'BUSINESS' else 'VEHICLE' end) or
   coalesce(new.breakdown->>'quoteHash','') !~ '^[a-f0-9]{64}$' or
   coalesce(new.breakdown->>'calculatedAmount','') !~ '^(0|[1-9][0-9]{0,8})$' or
   coalesce(new.breakdown->>'billingMode','') not in ('HOURLY','DAILY') or
   jsonb_typeof(new.breakdown->'lines') is distinct from 'array' then
    raise exception using errcode='23514',constraint='rental_quote_snapshots_breakdown_matches',message='Quotation breakdown must match the selected rate and rental';
  end if;
  if (new.breakdown->>'startAt')::timestamptz is distinct from r.start_at or (new.breakdown->>'endAt')::timestamptz is distinct from r.end_at or
   (new.breakdown->>'hourlyRate')::numeric is distinct from card.hourly_rate or (new.breakdown->>'dailyRate')::numeric is distinct from card.daily_rate or
   (new.breakdown->>'minimumCharge')::numeric is distinct from card.minimum_charge or (new.breakdown->>'extraHourRate')::numeric is distinct from card.extra_hour_rate or
   (new.breakdown->>'effectiveFrom')::timestamptz is distinct from card.effective_from or (new.breakdown->>'effectiveUntil')::timestamptz is distinct from card.effective_until or
   jsonb_array_length(new.breakdown->'lines') not between 1 and 4 then
    raise exception using errcode='23514',constraint='rental_quote_snapshots_breakdown_matches',message='Quotation source and schedule must match';
  end if;
  for line in select value from jsonb_array_elements(new.breakdown->'lines') loop
   if coalesce(line->>'units','') !~ '^[1-9][0-9]*$' or coalesce(line->>'unitPrice','') !~ '^(0|[1-9][0-9]{0,8})$' or coalesce(line->>'amount','') !~ '^(0|[1-9][0-9]{0,8})$' or coalesce(line->>'kind','') not in ('HOUR','DAY','EXTRA_HOUR','DAY_CAP','MINIMUM') then
    raise exception using errcode='23514',constraint='rental_quote_snapshots_lines_match',message='Quotation lines must contain exact integer VND';
   end if;
   if (line->>'amount')::numeric<>(line->>'units')::numeric*(line->>'unitPrice')::numeric then
    raise exception using errcode='23514',constraint='rental_quote_snapshots_lines_match',message='Quotation line amount must match its units and unit price';
   end if;
   line_sum:=line_sum+(line->>'amount')::numeric;
  end loop;
  if line_sum<>(new.breakdown->>'calculatedAmount')::numeric or (new.mode='CALCULATED' and new.agreed_amount<>(new.breakdown->>'calculatedAmount')::numeric) then
   raise exception using errcode='23514',constraint='rental_quote_snapshots_lines_match',message='Quotation totals must match their lines';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.protect_rental_quote_snapshot() from PUBLIC,anon,authenticated;
create trigger rental_quote_snapshots_protect before insert or update or delete on public.rental_quote_snapshots for each row execute function public.protect_rental_quote_snapshot();

create function public.protect_quoted_rental_amount() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.rental_amount is distinct from old.rental_amount and exists(select 1 from public.rental_quote_snapshots q where q.business_id=old.business_id and q.rental_id=old.id) then
  raise exception using errcode='23001',constraint='rentals_quoted_amount_immutable',message='Confirmed quotation amount is immutable';
 end if;
 return new;
end $$;
revoke all on function public.protect_quoted_rental_amount() from PUBLIC,anon,authenticated;
create trigger rentals_protect_quoted_amount before update on public.rentals for each row execute function public.protect_quoted_rental_amount();

alter table public.rental_rate_cards enable row level security;
alter table public.rental_quote_snapshots enable row level security;
revoke all on public.rental_rate_cards,public.rental_quote_snapshots from PUBLIC,anon,authenticated;
grant select on public.rental_rate_cards,public.rental_quote_snapshots to authenticated;
create policy rental_rate_cards_owner on public.rental_rate_cards for select to authenticated using(exists(
 select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id join public.user_profiles p on p.user_id=m.user_id
 where b.id=rental_rate_cards.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE'));
create policy rental_quote_snapshots_owner on public.rental_quote_snapshots for select to authenticated using(exists(
 select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id join public.user_profiles p on p.user_id=m.user_id
 where b.id=rental_quote_snapshots.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE'));
