-- SCMv2 migration from Base44 to Supabase (independent app)
-- Model: generic envelope per entity -> id, created_date, updated_date, data (jsonb).
-- This preserves 100% of Base44 entity fields (including nested arrays/objects)
-- without loss, and keeps frontend logic unchanged. Filtering/sorting/limiting
-- is applied in the frontend data layer (src/api/db.js), so PostgREST only
-- needs these base columns plus GIN indexes on data.
--
-- Apply: supabase db push  (after `supabase link --project-ref rnbcxepjmwjbjqnnznlj`)
-- or paste into Supabase Dashboard > SQL Editor.
--
-- Tables cover all 23 Base44 entities:
-- AccurateSetting, Announcement, AuditLog, BarcodeScan, Category,
-- FeaturePermission, Fleet, Item, MasterPackingItem, Outlet, Production,
-- ProductionProcess, ProductionRequest, Receipt, ReceiptProcess,
-- ReceiptVerification, Shipment, StockItem, StockMovement, User (-> profiles),
-- UserRequest (-> user_requests), Vendor, Warehouse.

-- Enable pgcrypto for gen_random_uuid() if not present
create extension if not exists "pgcrypto";

-- Helper: updated_date trigger
create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

-- Generic envelope tables
do $$
declare
  t text;
  tables text[] := array[
    'accurate_settings',
    'announcements',
    'audit_logs',
    'barcode_scans',
    'categories',
    'feature_permissions',
    'fleets',
    'items',
    'master_packing_items',
    'outlets',
    'productions',
    'production_processes',
    'production_requests',
    'receipts',
    'receipt_processes',
    'receipt_verifications',
    'shipments',
    'stock_items',
    'stock_movements',
    'user_requests',
    'vendors',
    'warehouses'
  ];
begin
  foreach t in array tables loop
    execute format('
      create table if not exists public.%I (
        id uuid primary key default gen_random_uuid(),
        created_date timestamptz not null default now(),
        updated_date timestamptz not null default now(),
        data jsonb not null default ''{}''::jsonb
      );', t);
    execute format('create index if not exists %I_data_gin on public.%I using gin (data);', t, t);
    execute format('drop trigger if exists trg_%I_updated on public.%I;', t, t);
    execute format('create trigger trg_%I_updated before update on public.%I for each row execute function public.set_updated_date();', t, t);
  end loop;
end;
$$;

-- Profiles table (Base44 "User" entity). id matches auth.users.id.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create index if not exists profiles_data_gin on public.profiles using gin (data);
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_date();

-- Auto-create a profile row on signup (default role crew, email from auth user).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, data)
  values (
    new.id,
    jsonb_build_object('email', lower(coalesce(new.email, '')), 'role', 'crew')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- NOTE: The app enforces roles in its own logic (manageUsers service +
-- FeaturePermission rows). These policies keep behaviour identical to Base44
-- defaults (authenticated users can read/write app data). Tighten later if
-- you need per-warehouse isolation.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'accurate_settings', 'announcements', 'audit_logs', 'barcode_scans',
    'categories', 'feature_permissions', 'fleets', 'items',
    'master_packing_items', 'outlets', 'productions', 'production_processes',
    'production_requests', 'receipts', 'receipt_processes',
    'receipt_verifications', 'shipments', 'stock_items', 'stock_movements',
    'user_requests', 'vendors', 'warehouses', 'profiles'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_authenticated_all on public.%I;', t, t);
    execute format('create policy %I_authenticated_all on public.%I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end;
$$;

-- Public (anon) reads needed for pre-login flows:
-- Register page lists warehouses; login/forgot pages need nothing else.
drop policy if exists warehouses_anon_read on public.warehouses;
create policy warehouses_anon_read on public.warehouses
  for select to anon using (true);

-- Allow anon to submit access requests (Base44 createRequest is public).
drop policy if exists user_requests_anon_insert on public.user_requests;
create policy user_requests_anon_insert on public.user_requests
  for insert to anon with check (true);

-- ---------------------------------------------------------------------------
-- Storage: uploads bucket (replaces base44.integrations.Core.UploadFile)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

drop policy if exists uploads_authenticated_all on storage.objects;
create policy uploads_authenticated_all on storage.objects
  for all to authenticated using (bucket_id = 'uploads') with check (bucket_id = 'uploads');

drop policy if exists uploads_anon_read on storage.objects;
create policy uploads_anon_read on storage.objects
  for select to anon using (bucket_id = 'uploads');
