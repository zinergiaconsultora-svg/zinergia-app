-- Commission Rules Table
-- Allows admins to configure commission splits without touching code.
-- The active rule (is_active = true, most recent effective_from) is used
-- by the commission processing logic when a proposal is accepted.

create table if not exists public.commission_rules (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    commission_rate numeric(5,4) not null default 0.15,  -- % of annual_savings as pot
    agent_share     numeric(5,4) not null default 0.30,  -- agent's cut of pot
    franchise_share numeric(5,4) not null default 0.50,  -- franchise's cut of pot
    hq_share        numeric(5,4) not null default 0.20,  -- hq's cut of pot
    points_per_win  integer not null default 50,          -- gamification points
    is_active       boolean not null default true,
    effective_from  timestamptz not null default now(),
    created_by      uuid references auth.users(id),
    created_at      timestamptz not null default now(),

    -- Shares must sum to 1.0
    constraint shares_sum_to_one check (
        round(agent_share + franchise_share + hq_share, 4) = 1.0
    ),
    -- Rates must be between 0 and 1
    constraint valid_commission_rate check (commission_rate > 0 and commission_rate <= 1),
    constraint valid_agent_share     check (agent_share > 0 and agent_share < 1),
    constraint valid_franchise_share check (franchise_share > 0 and franchise_share < 1),
    constraint valid_hq_share        check (hq_share > 0 and hq_share < 1)
);

-- Only one active rule at a time
create unique index if not exists commission_rules_single_active
    on public.commission_rules (is_active)
    where is_active = true;

-- RLS: only admin/franchise roles can read/write
alter table public.commission_rules enable row level security;

create policy "Admin and franchise can manage commission rules"
    on public.commission_rules
    for all
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and role in ('admin', 'franchise')
        )
    );

-- Seed default rule
insert into public.commission_rules (name, commission_rate, agent_share, franchise_share, hq_share, points_per_win, is_active)
values ('Regla por defecto', 0.15, 0.30, 0.50, 0.20, 50, true)
on conflict do nothing;
