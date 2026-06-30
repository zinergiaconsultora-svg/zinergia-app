-- Proposal pricing history.
-- Each proposal keeps the tariff/pricing snapshot used when it was created.
-- Repricing with the current catalog must create a new proposal version instead
-- of mutating historical numbers.

alter table public.lv_zinergia_tarifas
    add column if not exists catalog_version integer not null default 1,
    add column if not exists effective_from date not null default current_date,
    add column if not exists effective_to date,
    add column if not exists price_fingerprint text;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'lv_zinergia_tarifas_catalog_version_positive'
          and conrelid = 'public.lv_zinergia_tarifas'::regclass
    ) then
        alter table public.lv_zinergia_tarifas
            add constraint lv_zinergia_tarifas_catalog_version_positive
            check (catalog_version > 0);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'lv_zinergia_tarifas_effective_range_valid'
          and conrelid = 'public.lv_zinergia_tarifas'::regclass
    ) then
        alter table public.lv_zinergia_tarifas
            add constraint lv_zinergia_tarifas_effective_range_valid
            check (effective_to is null or effective_to >= effective_from);
    end if;
end $$;

update public.lv_zinergia_tarifas
set price_fingerprint = md5(concat_ws('|',
    coalesce(company, ''),
    coalesce(tariff_name, ''),
    coalesce(tariff_type, ''),
    coalesce(offer_type, ''),
    coalesce(modelo, ''),
    coalesce(fixed_fee::text, '0'),
    coalesce(surplus_compensation_price::text, '0'),
    coalesce(power_price_p1::text, '0'),
    coalesce(power_price_p2::text, '0'),
    coalesce(power_price_p3::text, '0'),
    coalesce(power_price_p4::text, '0'),
    coalesce(power_price_p5::text, '0'),
    coalesce(power_price_p6::text, '0'),
    coalesce(energy_price_p1::text, '0'),
    coalesce(energy_price_p2::text, '0'),
    coalesce(energy_price_p3::text, '0'),
    coalesce(energy_price_p4::text, '0'),
    coalesce(energy_price_p5::text, '0'),
    coalesce(energy_price_p6::text, '0')
))
where price_fingerprint is null;

alter table public.proposals
    add column if not exists source_tariff_id uuid,
    add column if not exists source_proposal_id uuid,
    add column if not exists proposal_version integer not null default 1,
    add column if not exists price_snapshot jsonb not null default '{}'::jsonb,
    add column if not exists price_snapshot_at timestamptz not null default now(),
    add column if not exists pricing_status text not null default 'snapshot',
    add column if not exists repriced_at timestamptz,
    add column if not exists repricing_delta_eur numeric(12,2);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'proposals_proposal_version_positive'
          and conrelid = 'public.proposals'::regclass
    ) then
        alter table public.proposals
            add constraint proposals_proposal_version_positive
            check (proposal_version > 0);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'proposals_pricing_status_valid'
          and conrelid = 'public.proposals'::regclass
    ) then
        alter table public.proposals
            add constraint proposals_pricing_status_valid
            check (pricing_status in ('snapshot', 'current', 'outdated', 'recalculated', 'manual', 'locked'));
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'proposals_source_proposal_id_fkey'
          and conrelid = 'public.proposals'::regclass
    ) then
        alter table public.proposals
            add constraint proposals_source_proposal_id_fkey
            foreign key (source_proposal_id)
            references public.proposals(id)
            on delete set null;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'proposals_source_tariff_id_fkey'
          and conrelid = 'public.proposals'::regclass
    ) then
        alter table public.proposals
            add constraint proposals_source_tariff_id_fkey
            foreign key (source_tariff_id)
            references public.lv_zinergia_tarifas(id)
            on delete set null;
    end if;
end $$;

update public.proposals p
set source_tariff_id = (p.offer_snapshot ->> 'id')::uuid
where p.source_tariff_id is null
  and (p.offer_snapshot ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
      select 1
      from public.lv_zinergia_tarifas t
      where t.id = (p.offer_snapshot ->> 'id')::uuid
  );

update public.proposals
set price_snapshot_at = coalesce(created_at, price_snapshot_at, now())
where price_snapshot_at is not null;

update public.proposals
set pricing_status = case
        when status = 'accepted' or signed_at is not null or public_accepted_at is not null then 'locked'
        when coalesce(offer_snapshot ->> 'id', '') like 'custom-%' then 'manual'
        else pricing_status
    end;

update public.proposals
set price_snapshot = jsonb_build_object(
        'captured_at', coalesce(created_at, now()),
        'source', 'backfill',
        'tariff_id', source_tariff_id,
        'offer', offer_snapshot,
        'current_annual_cost', current_annual_cost,
        'offer_annual_cost', offer_annual_cost,
        'annual_savings', annual_savings,
        'savings_percent', savings_percent
    )
where price_snapshot = '{}'::jsonb;

create index if not exists idx_lv_zinergia_tarifas_price_fingerprint
    on public.lv_zinergia_tarifas (price_fingerprint);

create index if not exists idx_lv_zinergia_tarifas_active_catalog
    on public.lv_zinergia_tarifas (company, tariff_name, supply_type, tipo_cliente, is_active, catalog_version);

create index if not exists idx_proposals_source_proposal_id
    on public.proposals (source_proposal_id);

create index if not exists idx_proposals_source_tariff_id
    on public.proposals (source_tariff_id);

create index if not exists idx_proposals_pricing_status
    on public.proposals (pricing_status);

create index if not exists idx_proposals_price_snapshot_at
    on public.proposals (price_snapshot_at desc);
