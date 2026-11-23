-- Coin Stone (category 49) gets a seventh colour, Monalisa White, as its own
-- row (owner_category_id = 49) like the other six. Its swatch is a round gem
-- tinted with the colour taken from the owner's photo
-- (public/reference/colors/coin-stone/monalisa-white.webp). sort_order 0 puts
-- it ahead of Monalisa Pink and Mint so the three Monalisas sit together.
-- Repeat-safe; never overwrites a row that already exists.
begin;

insert into public.colors (name, hex_value, sort_order, owner_category_id, ref_photo_url)
select 'Monalisa White', '#E6EAEC', 0, 49, '/reference/colors/coin-stone/monalisa-white.webp'
where exists (select 1 from public.categories where id = 49)
  and not exists (select 1 from public.colors c where c.owner_category_id = 49 and c.name = 'Monalisa White');

insert into public.category_colors (category_id, color_id)
select 49, c.id from public.colors c
where c.owner_category_id = 49 and c.name = 'Monalisa White'
  and not exists (select 1 from public.category_colors x where x.category_id = 49 and x.color_id = c.id);

commit;
