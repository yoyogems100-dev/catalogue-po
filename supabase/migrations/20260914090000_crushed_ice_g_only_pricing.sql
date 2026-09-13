-- Owner selected 24 specific G colors as the only colors Crushed Ice Cut
-- should currently offer (replacing all 36 F colors and the other 42 G
-- colors). Each selected G color is matched to the F color it most closely
-- resembles by name/family, so it inherits that F color's existing price
-- group (and therefore the same shape x size RMB prices) instead of being
-- unpriced. Exact name matches: Morganite Orange, Champagne, Sky Blue,
-- L-Aquamarine, Sapphire Blue, White D, L-Pink, Tanzanite, L-Tanzanite,
-- White G. The rest matched by closest color family (e.g. Paraiba-A/B to
-- the two Paraiba variants, the Purple/Purplish Pink/Purple Blue set to
-- Violet and Lavender Bluish, the Blue set to Blue Topaz and L-Sky Blue).

-- Replace the category's color selection entirely with just these 24.
delete from category_colors where category_id = 1;

insert into category_colors (category_id, color_id)
select 1, id from colors where name in (
  'G-05 Morganite Orange', 'G-08 Champagne', 'G-14 Yellow', 'G-15 L-Yellow',
  'G-18 Fancy Green', 'G-27 Paraiba-A', 'G-28 Paraiba-B', 'G-31 Sky Blue',
  'G-32 L-Aquamarine', 'G-35 Sapphire Blue', 'G-38 M-Fancy Blue', 'G-39 L-Fancy Blue',
  'G-40 White D', 'G-41 L-Pink', 'G-42 M-Pink', 'G-45 Light Padparadscha',
  'G-53 L-Fancy Purplish Pink', 'G-54 Rose Purple', 'G-55 Fancy Purple',
  'G-56 L-Fancy Purple Blue', 'G-57 Fancy Purple Blue', 'G-60 Tanzanite',
  'G-61 L-Tanzanite', 'G-66 White G'
);

-- Map each into its matched price group (by the group name, joined to
-- color_price_groups so this doesn't depend on hardcoded group ids).
insert into color_price_group_members (group_id, color_id)
select g.gid, c.id from colors c
join (values
  ('G-05 Morganite Orange', 'Medium Colors'),
  ('G-08 Champagne',        'Regular Colors'),
  ('G-14 Yellow',           'Regular Colors'),
  ('G-15 L-Yellow',         'Light Colors'),
  ('G-18 Fancy Green',      'Premium Colors'),
  ('G-27 Paraiba-A',        'Paraiba'),
  ('G-28 Paraiba-B',        'Paraiba'),
  ('G-31 Sky Blue',         'Premium Colors'),
  ('G-32 L-Aquamarine',     'Premium Colors'),
  ('G-35 Sapphire Blue',    'Royal Blue'),
  ('G-38 M-Fancy Blue',     'Premium Colors'),
  ('G-39 L-Fancy Blue',     'Premium Colors'),
  ('G-40 White D',          'White Zircon'),
  ('G-41 L-Pink',           'Light Colors'),
  ('G-42 M-Pink',           'Regular Colors'),
  ('G-45 Light Padparadscha','Regular Colors'),
  ('G-53 L-Fancy Purplish Pink', 'Light Colors'),
  ('G-54 Rose Purple',      'Medium Colors'),
  ('G-55 Fancy Purple',     'Medium Colors'),
  ('G-56 L-Fancy Purple Blue', 'Medium Colors'),
  ('G-57 Fancy Purple Blue',   'Medium Colors'),
  ('G-60 Tanzanite',        'Premium Colors'),
  ('G-61 L-Tanzanite',      'Premium Colors'),
  ('G-66 White G',          'Light Colors')
) as m(color_name, group_name) on m.color_name = c.name
join (select id as gid, name from color_price_groups) as g on g.name = m.group_name
on conflict (group_id, color_id) do nothing;
