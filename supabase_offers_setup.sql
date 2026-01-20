-- 1. Create the 'offers' table
create table if not exists offers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  franchise_id uuid references franchises(id) on delete cascade,
  marketer_name text not null,
  tariff_name text not null,
  description text,
  contract_duration text,
  logo_color text,
  type text check (type in ('fixed', 'indexed')) default 'fixed',
  power_price jsonb not null default '{}'::jsonb,
  energy_price jsonb not null default '{}'::jsonb,
  fixed_fee numeric default 0,
  is_active boolean default true
);

-- 2. Enable Row Level Security
alter table offers enable row level security;

-- 3. Define Policies for Tenant Isolation

-- Policy: View (Own Franchise + Global/System Offers)
drop policy if exists "Users can view offers" on offers;
create policy "Users can view offers"
  on offers for select
  using (
    franchise_id = (select franchise_id from profiles where id = auth.uid()) 
    or franchise_id is null
  );

-- Policy: Manage (Insert/Update/Delete - Own Franchise Only)
drop policy if exists "Users can manage offers" on offers;
create policy "Users can manage offers"
  on offers for all
  using (franchise_id = (select franchise_id from profiles where id = auth.uid()))
  with check (franchise_id = (select franchise_id from profiles where id = auth.uid()));

-- 4. Create Index for performance
create index if not exists offers_franchise_id_idx on offers(franchise_id);
