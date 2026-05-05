-- Enable UUID extension if not already
create extension if not exists "uuid-ossp";

-- 1. Update PROFILES table with Hierarchy & Roles
-- 'admin' = HQ (God mode)
-- 'franchise' = Regional Office (Can have sub-agents)
-- 'agent' = Collaborator (Individual contributor)
alter table profiles 
add column if not exists role text default 'agent' check (role in ('admin', 'franchise', 'agent')),
add column if not exists parent_id uuid references profiles(id);

-- 2. Create FRANCHISE_CONFIG table (Settings for Franchises)
create table if not exists franchise_config (
  id uuid primary key default uuid_generate_v4(),
  franchise_id uuid references profiles(id) not null unique,
  company_name text, -- If different from profile name
  royalty_percent numeric default 10.0, -- Default 10% royalty to HQ
  entry_fee numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- 3. Create INVITATIONS table (Magic Links)
create table if not exists network_invitations (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references profiles(id) not null,
  email text not null,
  role text not null check (role in ('franchise', 'agent')),
  code text unique not null, -- The magic string for the URL
  used boolean default false,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

-- 4. Enable RLS
alter table franchise_config enable row level security;
alter table network_invitations enable row level security;

-- 5. Policies
-- PROFILES: Everyone can see their own profile. 
-- Franchises can see their children (agents).
-- Admin can see everyone.

create policy "Users can see own profile" on profiles
  for select using (auth.uid() = id);

create policy "Franchises can see their agents" on profiles
  for select using (
    auth.uid() = parent_id 
    or 
    id in (select parent_id from profiles where id = auth.uid()) -- Agents see their parent
  );

create policy "Admin sees all" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- INVITATIONS: 
-- Creators can see their sent invitations
create policy "Creators see own invitations" on network_invitations
  for select using (auth.uid() = creator_id);
