-- Phone + password sign-in for customers, alongside the WhatsApp code.
--
-- The password lives in its own table, never on customers: several admin
-- pages and the CSV export read customers with select('*') and hand the row
-- to the browser, so a column there would leak.
--
--   password_hash  scrypt hash, what sign-in checks against
--   password_enc   AES-256-GCM copy the admin can reveal (owner's decision,
--                  2026-09-30: passwords visible to admin). Only server code
--                  holding the key can read it.
--   set_by         'admin' or 'customer', shown next to the date in admin
--
-- customer_login_failures rate-limits wrong passwords per phone and per
-- visitor (salted IP hash, never the address itself).
--
-- Both tables are service-role only: RLS on with no policies, and the anon /
-- authenticated grants Supabase adds to new public tables are revoked.
--
-- Additive and repeat-safe.

begin;

create table if not exists public.customer_credentials (
  customer_id bigint primary key references public.customers(id) on delete cascade,
  password_hash text not null,
  password_enc text,
  set_at timestamptz not null default now(),
  set_by text not null default 'customer' check (set_by in ('admin', 'customer'))
);

create table if not exists public.customer_login_failures (
  id bigserial primary key,
  phone text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists customer_login_failures_phone_idx on public.customer_login_failures (phone, created_at);
create index if not exists customer_login_failures_ip_idx on public.customer_login_failures (ip_hash, created_at);

alter table public.customer_credentials enable row level security;
alter table public.customer_login_failures enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.customer_credentials from %I', r);
      execute format('revoke all on public.customer_login_failures from %I', r);
      execute format('revoke all on sequence public.customer_login_failures_id_seq from %I', r);
    end if;
  end loop;
end $$;

commit;
