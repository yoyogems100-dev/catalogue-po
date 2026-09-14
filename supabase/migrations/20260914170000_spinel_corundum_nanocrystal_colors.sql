-- Real reference photos for three new synthetic-gem color families, sourced
-- from the owner's "Color card of Artificial Gems" reference sheet:
-- Synthetic Spinel (14 colors), Synthetic Corundum (16 colors) and
-- Synthetic NanoSital/Crystal (16 colors). Card numeric codes are kept as
-- the primary identifying part of each color name (per owner request),
-- since several codes share no English gloss and some English names repeat
-- across different codes on the same card (e.g. "Morganite" appears twice).
--
-- These are added as three standalone color_palettes groups only. No
-- category's color selection is changed here -- the owner will attach these
-- groups to new categories themselves when those categories are created.

insert into public.colors (name, hex_value, ref_photo_url)
values
  -- Synthetic Spinel
  ('104#', '#6D7177', '/reference/colors/spinel/104.webp'),
  ('106#', '#708297', '/reference/colors/spinel/106.webp'),
  ('107# Aquamarine', '#245292', '/reference/colors/spinel/107-aquamarine.webp'),
  ('108#', '#6A717A', '/reference/colors/spinel/108.webp'),
  ('119#', '#1C51A4', '/reference/colors/spinel/119.webp'),
  ('120# Zircon Blue', '#6A8699', '/reference/colors/spinel/120-zircon-blue.webp'),
  ('112#', '#131564', '/reference/colors/spinel/112.webp'),
  ('113# Burma Blue', '#060878', '/reference/colors/spinel/113-burma-blue.webp'),
  ('114#', '#0C0C1E', '/reference/colors/spinel/114.webp'),
  ('135# Brazil Green', '#768671', '/reference/colors/spinel/135-brazil-green.webp'),
  ('149#', '#757C62', '/reference/colors/spinel/149.webp'),
  ('152# Tourmaline Green', '#6A796E', '/reference/colors/spinel/152-tourmaline-green.webp'),
  ('YAG Paraiba', '#26908C', '/reference/colors/spinel/yag-paraiba.webp'),
  ('Ruby 5# Opaque', '#87605C', '/reference/colors/spinel/ruby5-opaque.webp'),

  -- Synthetic Corundum
  ('1.25# L-Pink', '#8C7C75', '/reference/colors/corundum/1-25-lpink.webp'),
  ('2# Pink', '#895479', '/reference/colors/corundum/2-pink.webp'),
  ('3# Rose', '#89416E', '/reference/colors/corundum/3-rose.webp'),
  ('5# Ruby', '#7B686C', '/reference/colors/corundum/5-ruby.webp'),
  ('8# Red', '#974750', '/reference/colors/corundum/8-red.webp'),
  ('12# White', '#8E8A84', '/reference/colors/corundum/12-white.webp'),
  ('20# Lemon', '#948D49', '/reference/colors/corundum/20-lemon.webp'),
  ('22# Gold', '#8F682C', '/reference/colors/corundum/22-gold.webp'),
  ('32# Sapphire Blue', '#4B5895', '/reference/colors/corundum/32-sapphire-blue.webp'),
  ('34#', '#282682', '/reference/colors/corundum/34.webp'),
  ('45# Alexandrite', '#85848D', '/reference/colors/corundum/45-alexandrite.webp'),
  ('46#', '#7F678D', '/reference/colors/corundum/46.webp'),
  ('55# Padparadscha', '#84301E', '/reference/colors/corundum/55-padparadscha.webp'),
  ('61# Violet', '#686975', '/reference/colors/corundum/61-violet.webp'),
  ('65# Purple', '#785680', '/reference/colors/corundum/65-purple.webp'),
  ('73# Mint Green', '#6D9197', '/reference/colors/corundum/73-mint-green.webp'),

  -- Synthetic NanoSital / Crystal
  ('#Anz1536 Change Color', '#766C1F', '/reference/colors/nanocrystal/anz1536-change-color.webp'),
  ('#204 London Blue', '#998848', '/reference/colors/nanocrystal/204-london-blue.webp'),
  ('#46', '#4E778E', '/reference/colors/nanocrystal/46.webp'),
  ('#45 Morganite', '#9C847E', '/reference/colors/nanocrystal/45-morganite.webp'),
  ('#A-756 Grey', '#66719E', '/reference/colors/nanocrystal/a756-grey.webp'),
  ('#A-75 Paraiba', '#5C8C89', '/reference/colors/nanocrystal/a75-paraiba.webp'),
  ('#172 Peridot', '#8A9D28', '/reference/colors/nanocrystal/172-peridot.webp'),
  ('#B-1713 Tsavorite', '#4D941D', '/reference/colors/nanocrystal/b1713-tsavorite.webp'),
  ('#A-111 Sky Blue', '#798E99', '/reference/colors/nanocrystal/a111-sky-blue.webp'),
  ('#A597 Sapphire Blue', '#3444A1', '/reference/colors/nanocrystal/a597-sapphire-blue.webp'),
  ('#0/2 Emerald 113', '#2E7945', '/reference/colors/nanocrystal/0-2-emerald-113.webp'),
  ('103/3 Brazil Green', '#809585', '/reference/colors/nanocrystal/103-3-brazil-green.webp'),
  ('180 Morganite', '#9C847E', '/reference/colors/nanocrystal/45-morganite.webp'),
  ('185 Ruby', '#642635', '/reference/colors/nanocrystal/185-ruby.webp'),
  ('312 Turquoise Green', '#2F617C', '/reference/colors/nanocrystal/312-turquoise-green.webp'),
  ('332 Turquoise Bluish', '#305980', '/reference/colors/nanocrystal/332-turquoise-bluish.webp')
on conflict do nothing;

-- Three standalone quick-select groups, one per material.
insert into public.color_palettes (name)
select v.name
from (values ('Synthetic Spinel'), ('Synthetic Corundum'), ('Synthetic NanoSital / Crystal')) as v(name)
where not exists (select 1 from public.color_palettes existing where existing.name = v.name);

insert into public.color_palette_items (palette_id, color_id)
select p.id, c.id
from public.color_palettes p
join public.colors c on c.name in (
  '104#','106#','107# Aquamarine','108#','119#','120# Zircon Blue','112#','113# Burma Blue','114#',
  '135# Brazil Green','149#','152# Tourmaline Green','YAG Paraiba','Ruby 5# Opaque'
)
where p.name = 'Synthetic Spinel'
on conflict (palette_id, color_id) do nothing;

insert into public.color_palette_items (palette_id, color_id)
select p.id, c.id
from public.color_palettes p
join public.colors c on c.name in (
  '1.25# L-Pink','2# Pink','3# Rose','5# Ruby','8# Red','12# White','20# Lemon','22# Gold',
  '32# Sapphire Blue','34#','45# Alexandrite','46#','55# Padparadscha','61# Violet','65# Purple','73# Mint Green'
)
where p.name = 'Synthetic Corundum'
on conflict (palette_id, color_id) do nothing;

insert into public.color_palette_items (palette_id, color_id)
select p.id, c.id
from public.color_palettes p
join public.colors c on c.name in (
  '#Anz1536 Change Color','#204 London Blue','#46','#45 Morganite','#A-756 Grey','#A-75 Paraiba',
  '#172 Peridot','#B-1713 Tsavorite','#A-111 Sky Blue','#A597 Sapphire Blue','#0/2 Emerald 113',
  '103/3 Brazil Green','180 Morganite','185 Ruby','312 Turquoise Green','332 Turquoise Bluish'
)
where p.name = 'Synthetic NanoSital / Crystal'
on conflict (palette_id, color_id) do nothing;
