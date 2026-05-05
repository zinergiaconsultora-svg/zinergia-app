-- 1. Create PROPOSALS table
create table if not exists proposals (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  franchise_id uuid references franchises(id) on delete cascade, -- Optional depending on your RLS
  status text check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')) default 'draft',
  created_at timestamptz default now(),
  offer_snapshot jsonb not null, -- Stores the offer details at the time of proposal
  calculation_data jsonb not null, -- Stores the invoice data used for the simulation
  current_annual_cost numeric not null,
  offer_annual_cost numeric not null,
  annual_savings numeric not null,
  savings_percent numeric not null,
  optimization_result jsonb, -- Stores potential power optimization data
  updated_at timestamptz default now()
);

-- 2. Enable RLS
alter table proposals enable row level security;

-- 3. Create basic policies for proposals
create policy "Franchises can see their own proposals" on proposals
  for select using (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.franchise_id = proposals.franchise_id
    )
  );

create policy "Franchises can insert their own proposals" on proposals
  for insert with check (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.franchise_id = proposals.franchise_id
    )
  );

create policy "Franchises can update their own proposals" on proposals
  for update using (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.franchise_id = proposals.franchise_id
    )
  );
