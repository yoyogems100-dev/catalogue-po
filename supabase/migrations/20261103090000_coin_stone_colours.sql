-- Coin Stone (category 49) gets its own six colours, photographed from the
-- owner's swatches (public/reference/colors/coin-stone/). They are Coin
-- Stone's own rows (owner_category_id = 49), so "Green" here is a different
-- stone from the shared Green that other categories offer: buyers see plain
-- "Green" inside Coin Stone, and admin tags it "Coin Stone only". Repeat-safe;
-- a photo or hex changed later in admin is never overwritten.
begin;

insert into public.colors (name, hex_value, sort_order, owner_category_id, ref_photo_url)
select v.name, v.hex, v.sort, 49, v.url
from (values
  ('Monalisa Pink', '#E7BFD2', 1, '/reference/colors/coin-stone/monalisa-pink.webp'),
  ('Monalisa Mint', '#9CD3BA', 2, '/reference/colors/coin-stone/monalisa-mint.webp'),
  ('Black',         '#121212', 3, '/reference/colors/coin-stone/black.webp'),
  ('Red',           '#C0201A', 4, '/reference/colors/coin-stone/red.webp'),
  ('Green',         '#1E9A3C', 5, '/reference/colors/coin-stone/green.webp'),
  ('Blue',          '#24418F', 6, '/reference/colors/coin-stone/blue.webp')
) as v(name, hex, sort, url)
where exists (select 1 from public.categories where id = 49)
  and not exists (select 1 from public.colors c where c.owner_category_id = 49 and c.name = v.name);

insert into public.category_colors (category_id, color_id)
select 49, c.id from public.colors c
where c.owner_category_id = 49
  and not exists (select 1 from public.category_colors x where x.category_id = 49 and x.color_id = c.id);

commit;
