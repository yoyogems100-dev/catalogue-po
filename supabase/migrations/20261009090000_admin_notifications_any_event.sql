-- Admin notifications for more than orders: sign-up requests, website
-- catalogue requests and customer notes. Such a notification has no order,
-- so order_id becomes optional and `link` says which admin page it opens.
begin;
alter table public.notifications alter column order_id drop not null;
alter table public.notifications add column if not exists link text;
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
commit;
