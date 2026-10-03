-- Crushed Ice Cut (category 1): offer every colour on the supplier's
-- "Color Card CZ For Crushed Ice Cutting" chart. Additive only -- nothing is
-- unlinked, renamed or repriced.
--   1. 21 chart colours already in the G list (G-01..G-66) get linked.
--   2. 16 chart codes not in the list yet (G-69..G-84) are created, with
--      photos cropped from the chart, and linked.
-- New links have no price group; prices stay "on request" until the admin
-- assigns them in Pricing.
begin;

with v(name, hex_value, ref_photo_url, sort_order) as (values
  ('G-69 Rhodolite', '#8A3F55', '/reference/colors/crushed-ice/g69-rhodolite.webp', 125),
  ('G-70 Mars Stone', '#6E4A50', '/reference/colors/crushed-ice/g70-mars-stone.webp', 126),
  ('G-71 Papaya Yellow', '#F07A12', '/reference/colors/crushed-ice/g71-papaya-yellow.webp', 127),
  ('G-72 Faint Yellow', '#F3F0D8', '/reference/colors/crushed-ice/g72-faint-yellow.webp', 128),
  ('G-73 L-Gray', '#6E6260', '/reference/colors/crushed-ice/g73-l-gray.webp', 129),
  ('G-74 L-Coffee', '#7A5A4C', '/reference/colors/crushed-ice/g74-l-coffee.webp', 130),
  ('G-75 Green Tourmaline', '#4E5A44', '/reference/colors/crushed-ice/g75-green-tourmaline.webp', 131),
  ('G-76 Paraiba Bluish', '#12A89A', '/reference/colors/crushed-ice/g76-paraiba-bluish.webp', 132),
  ('G-77 Paraiba Greenish', '#2EB84A', '/reference/colors/crushed-ice/g77-paraiba-greenish.webp', 133),
  ('G-78 D-Mint Green', '#7FCB5E', '/reference/colors/crushed-ice/g78-d-mint-green.webp', 134),
  ('G-79 Mint Green', '#BFE3C0', '/reference/colors/crushed-ice/g79-mint-green.webp', 135),
  ('G-80 Mint Blue', '#BDE6D8', '/reference/colors/crushed-ice/g80-mint-blue.webp', 136),
  ('G-81 Lavender', '#A8A8D8', '/reference/colors/crushed-ice/g81-lavender.webp', 137),
  ('G-82 D-Rose Purple', '#6E2F78', '/reference/colors/crushed-ice/g82-d-rose-purple.webp', 138),
  ('G-83 Rosy Color', '#5A3550', '/reference/colors/crushed-ice/g83-rosy-color.webp', 139),
  ('G-84 Partschinite', '#E0461C', '/reference/colors/crushed-ice/g84-partschinite.webp', 140)
)
insert into colors (name, hex_value, ref_photo_url, sort_order)
select v.name, v.hex_value, v.ref_photo_url, v.sort_order from v
where not exists (select 1 from colors c where c.name = v.name and c.owner_category_id is null);

insert into color_palette_items (palette_id, color_id)
select p.id, c.id
from color_palettes p join colors c on c.name ~ '^G-(69|7[0-9]|8[0-4]) ' and c.owner_category_id is null
where p.name = 'G - Crushed Ice Cut'
on conflict (palette_id, color_id) do nothing;

insert into category_colors (category_id, color_id)
select 1, c.id from colors c
where c.owner_category_id is null and split_part(c.name, ' ', 1) in (
  'G-01','G-02','G-07','G-12','G-13','G-16','G-17','G-19','G-20','G-21','G-24',
  'G-30','G-33','G-34','G-36','G-37','G-44','G-46','G-49','G-52','G-58','G-59',
  'G-69','G-70','G-71','G-72','G-73','G-74','G-75','G-76','G-77','G-78','G-79',
  'G-80','G-81','G-82','G-83','G-84')
on conflict (category_id, color_id) do nothing;

commit;
