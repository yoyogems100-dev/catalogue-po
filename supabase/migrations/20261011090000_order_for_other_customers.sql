-- Let a trusted customer account (the owner's own, for demos and phone
-- orders) switch to any customer in /po and place orders on their behalf.
--   customers.can_order_for_others  -- set from the admin customer page
--   orders.placed_by_customer_id    -- who actually placed it, when not the buyer
-- Mahi / Mickey.co (customer 1) is turned on, as the owner asked on 2026-10-03.
begin;
alter table public.customers add column if not exists can_order_for_others boolean not null default false;
alter table public.orders add column if not exists placed_by_customer_id bigint references public.customers(id) on delete set null;
update public.customers set can_order_for_others = true where id = 1 and phone = '6376512595';
commit;
