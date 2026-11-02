-- Optional legal/identity fields; old records remain readable with empty values.
alter table public.businesses add column legal_name text not null default '';
alter table public.businesses add constraint businesses_legal_name_contract_check check(legal_name=btrim(legal_name) and length(legal_name)<=120);
alter table public.businesses add column address text not null default '';
alter table public.businesses add constraint businesses_address_contract_check check(address=btrim(address) and length(address)<=500);
alter table public.businesses add column phone text not null default '';
alter table public.businesses add constraint businesses_phone_contract_check check(phone=btrim(phone) and length(phone)<=32);
alter table public.businesses add column tax_code text not null default '';
alter table public.businesses add constraint businesses_tax_code_contract_check check(tax_code=btrim(tax_code) and length(tax_code)<=32);
alter table public.businesses add column representative_name text not null default '';
alter table public.businesses add constraint businesses_representative_name_contract_check check(representative_name=btrim(representative_name) and length(representative_name)<=120);
alter table public.businesses add column representative_title text not null default '';
alter table public.businesses add constraint businesses_representative_title_contract_check check(representative_title=btrim(representative_title) and length(representative_title)<=80);
alter table public.businesses add column contract_terms text not null default '';
alter table public.businesses add constraint businesses_contract_terms_contract_check check(contract_terms=btrim(contract_terms) and length(contract_terms)<=8000);
alter table public.customers add column id_number text not null default '';
alter table public.customers add constraint customers_id_number_contract_check check(id_number=btrim(id_number) and length(id_number)<=32);
alter table public.customers add column address text not null default '';
alter table public.customers add constraint customers_address_contract_check check(address=btrim(address) and length(address)<=500);
alter table public.customers add column driver_license_number text not null default '';
alter table public.customers add constraint customers_driver_license_number_contract_check check(driver_license_number=btrim(driver_license_number) and length(driver_license_number)<=32);
alter table public.customers add column driver_license_class text not null default '';
alter table public.customers add constraint customers_driver_license_class_contract_check check(driver_license_class=btrim(driver_license_class) and length(driver_license_class)<=8);
alter table public.businesses add constraint businesses_contract_phone_check check(phone='' or phone ~ '^\+?[0-9][0-9 -]{4,31}$');

create table public.rental_contract_documents (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 rental_id uuid not null,
 seq integer not null,
 doc_number text not null,
 version integer not null,
 content_hash text not null,
 snapshot jsonb not null,
 issued_by uuid not null,
 issued_at timestamptz not null default now(),
 constraint rental_contract_documents_business_seq_unique unique(business_id,seq),
 constraint rental_contract_documents_rental_version_unique unique(rental_id,version),
 constraint rental_contract_documents_rental_tenant_fk foreign key(business_id,rental_id) references public.rentals(business_id,id) on delete restrict,
 constraint rental_contract_documents_number_check check(seq between 1 and 999999 and version>0 and doc_number ~ '^HD-[0-9]{4}-[0-9]{6}$' and right(doc_number,6)=lpad(seq::text,6,'0')),
 constraint rental_contract_documents_hash_check check(content_hash ~ '^[a-f0-9]{64}$'),
 constraint rental_contract_documents_snapshot_check check(
  jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=65536 and
  (snapshot->>'schemaVersion') is not distinct from '1' and
  (snapshot->'rental'->>'id') is not distinct from rental_id::text and
  jsonb_typeof(snapshot->'business') is not distinct from 'object' and
  jsonb_typeof(snapshot->'customer') is not distinct from 'object' and
  jsonb_typeof(snapshot->'vehicle') is not distinct from 'object' and
  jsonb_typeof(snapshot->'missing') is not distinct from 'array' and
  jsonb_typeof(snapshot->'terms') is not distinct from 'string'
 ),
 constraint rental_contract_documents_time_check check(isfinite(issued_at))
);
create index rental_contract_documents_business_rental_version on public.rental_contract_documents(business_id,rental_id,version desc);
create function public.prevent_rental_contract_document_mutation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception using errcode='23001',constraint='rental_contract_documents_immutable',message='Issued contract documents are immutable';
end $$;
revoke all on function public.prevent_rental_contract_document_mutation() from PUBLIC,anon,authenticated;
create trigger rental_contract_documents_immutable before update or delete on public.rental_contract_documents for each row execute function public.prevent_rental_contract_document_mutation();
alter table public.rental_contract_documents enable row level security;
revoke all on public.rental_contract_documents from PUBLIC,anon,authenticated;
grant select on public.rental_contract_documents to authenticated;
create policy rental_contract_documents_owner on public.rental_contract_documents for select to authenticated using(exists(
 select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id join public.user_profiles p on p.user_id=m.user_id
 where b.id=rental_contract_documents.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key='OWNER' and p.status='ACTIVE'
));
