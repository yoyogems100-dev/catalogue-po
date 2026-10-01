-- "Curated for you": the categories the team picks for each buyer from their
-- go-to requirements, shown first on that buyer's /po home page, and whether
-- the shelf shows at all. Order matters -- it is the order on the shelf.
begin;
alter table public.customers
  add column if not exists interest_category_ids integer[] not null default '{}',
  add column if not exists show_interests boolean not null default true;
commit;
