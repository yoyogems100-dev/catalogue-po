-- A customer's own copy of a category's price list (Crushed Ice G-Series
-- today). Prices differ by buyer and by day, so the admin can keep each
-- customer's latest prices, pick them again on the Pricing page, and print
-- them under that customer's name. The category's default prices stay in
-- shape_size_prices; a customer list is a full snapshot taken from them and
-- edited, so later changes to the defaults never silently move a quote.
--
-- prices: [{ "s": shape_size_id, "g": price_group_id, "p": price }]
-- Admin-only: RLS on with no policies, so only the service role reads it.
begin;

create table if not exists customer_price_lists (
  id bigserial primary key,
  category_id integer not null references categories(id) on delete cascade,
  customer_name text not null check (length(btrim(customer_name)) between 1 and 80),
  price_date date not null default current_date,
  prices jsonb not null default '[]'::jsonb check (jsonb_typeof(prices) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One list per customer name per category; "sharma jewellers " is the same buyer.
create unique index if not exists customer_price_lists_name_key
  on customer_price_lists (category_id, lower(btrim(customer_name)));

alter table customer_price_lists enable row level security;

commit;
