-- What has gone out against each order line, so the team can track part
-- deliveries and balances in the app instead of a separate pending sheet.
--   sent_qty     pieces (or the line's unit) sent so far; balance = quantity - sent_qty
--   needs_check  the team has flagged the line to check (stock, quality, sample)
alter table public.order_items
  add column if not exists sent_qty integer not null default 0,
  add column if not exists needs_check boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_sent_qty_not_negative') then
    alter table public.order_items
      add constraint order_items_sent_qty_not_negative check (sent_qty >= 0);
  end if;
end $$;
