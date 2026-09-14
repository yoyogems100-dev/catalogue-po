-- New "CZ Color Chart" palette: 42 real stones from the owner's physical
-- Cubic Zirconia reference card (34 genuinely new colors + 8 that already
-- exist under an exact-matching name, reused rather than duplicated).
-- Also replaces Coloured CZ Stones' (category 12) entire color selection
-- with this set, per the owner's explicit request.

insert into public.colors (name, hex_value, ref_photo_url)
select v.name, v.hex_value, v.ref_photo_url
from (values
  ('Pink', '#51383C', '/reference/colors/czchart/pink.webp'),
  ('Rose', '#977F94', '/reference/colors/czchart/rose.webp'),
  ('Lemon', '#A7987B', '/reference/colors/czchart/lemon.webp'),
  ('Yellow', '#A08F2B', '/reference/colors/czchart/yellow.webp'),
  ('Golden Yellow', '#A38D23', '/reference/colors/czchart/golden-yellow.webp'),
  ('Violet', '#391C9F', '/reference/colors/czchart/violet.webp'),
  ('D-Violet', '#14005D', '/reference/colors/czchart/d-violet.webp'),
  ('Amethyst', '#2E1D6E', '/reference/colors/czchart/amethyst.webp'),
  ('D-Amethyst', '#230E4E', '/reference/colors/czchart/d-amethyst.webp'),
  ('Orange Red', '#B33A1E', '/reference/colors/czchart/orange-red.webp'),
  ('Garnet', '#A33B2E', '/reference/colors/czchart/garnet.webp'),
  ('D-Garnet', '#6D1210', '/reference/colors/czchart/d-garnet.webp'),
  ('Olive', '#8F8A3D', '/reference/colors/czchart/olive.webp'),
  ('Peridot', '#8FA13D', '/reference/colors/czchart/peridot.webp'),
  ('D-Peridot', '#43470C', '/reference/colors/czchart/d-peridot.webp'),
  ('D-Apple Green', '#7C8A2E', '/reference/colors/czchart/d-apple-green.webp'),
  ('D-Champagne', '#8A5A2E', '/reference/colors/czchart/d-champagne.webp'),
  ('Brown', '#6B4226', '/reference/colors/czchart/brown.webp'),
  ('D-Brown', '#613018', '/reference/colors/czchart/d-brown.webp'),
  ('L-Rhodolite', '#B37A8A', '/reference/colors/czchart/l-rhodolite.webp'),
  ('Rhodolite', '#8A4A5A', '/reference/colors/czchart/rhodolite.webp'),
  ('Sapphire Blue', '#0C2351', '/reference/colors/czchart/sapphire-blue.webp'),
  ('L-Tanzanite', '#7A82B3', '/reference/colors/czchart/l-tanzanite.webp'),
  ('Tanzanite', '#1D2050', '/reference/colors/czchart/tanzanite.webp'),
  ('L-Green', '#4FAE3D', '/reference/colors/czchart/l-green.webp'),
  ('Green', '#30BA4A', '/reference/colors/czchart/green.webp'),
  ('Aqua Blue', '#2E8AA1', '/reference/colors/czchart/aqua-blue.webp'),
  ('Blue Topaz', '#0F6E96', '/reference/colors/czchart/blue-topaz.webp'),
  ('Diamond L-Pink', '#B39490', '/reference/colors/czchart/diamond-l-pink.webp'),
  ('Diamond D-Pink', '#8A5A56', '/reference/colors/czchart/diamond-d-pink.webp'),
  ('Diamond Gold', '#B3A25A', '/reference/colors/czchart/diamond-gold.webp'),
  ('Morganite', '#B38A6A', '/reference/colors/czchart/morganite.webp'),
  ('Kunzite', '#8A6EBA', '/reference/colors/czchart/kunzite.webp'),
  ('Purple', '#5027BF', '/reference/colors/czchart/purple.webp')
) as v(name, hex_value, ref_photo_url)
where not exists (select 1 from public.colors existing where existing.name = v.name);

-- The palette itself: every color from the chart, new or reused.
insert into public.color_palettes (name)
select 'CZ Color Chart'
where not exists (select 1 from public.color_palettes where name = 'CZ Color Chart');

insert into public.color_palette_items (palette_id, color_id)
select p.id, c.id
from public.color_palettes p
join public.colors c on c.name in (
  'Pink','Rose','Lemon','Yellow','Golden Yellow','Lavender','Violet','D-Violet','Amethyst','D-Amethyst',
  'Orange','Orange Red','Garnet','D-Garnet','Olive','Peridot','D-Peridot','Apple Green','D-Apple Green',
  'Champagne','D-Champagne','Colorless / White','Black','Brown','D-Brown','Coffee','L-Rhodolite','Rhodolite',
  'Sapphire Blue','L-Tanzanite','Tanzanite','L-Green','Green','Aquamarine','Aqua Blue','Blue Topaz',
  'Diamond L-Pink','Diamond D-Pink','Diamond Gold','Morganite','Kunzite','Purple'
)
where p.name = 'CZ Color Chart'
on conflict (palette_id, color_id) do nothing;

-- Replace Coloured CZ Stones' (category 12) color selection with the chart set.
delete from public.category_colors where category_id = 12;

insert into public.category_colors (category_id, color_id)
select 12, c.id
from public.colors c
where c.name in (
  'Pink','Rose','Lemon','Yellow','Golden Yellow','Lavender','Violet','D-Violet','Amethyst','D-Amethyst',
  'Orange','Orange Red','Garnet','D-Garnet','Olive','Peridot','D-Peridot','Apple Green','D-Apple Green',
  'Champagne','D-Champagne','Colorless / White','Black','Brown','D-Brown','Coffee','L-Rhodolite','Rhodolite',
  'Sapphire Blue','L-Tanzanite','Tanzanite','L-Green','Green','Aquamarine','Aqua Blue','Blue Topaz',
  'Diamond L-Pink','Diamond D-Pink','Diamond Gold','Morganite','Kunzite','Purple'
)
on conflict (category_id, color_id) do nothing;
