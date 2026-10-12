-- Nano (category 3) now offers only these five colours (owner, 2026-10-12).
-- They're Nano's own colours; the swatch hex values are approximations until
-- photos are uploaded. The 55 colours Nano offered before are unlinked from
-- Nano only -- they stay in the catalogue and in their other categories, and
-- past Nano orders keep the colours they were placed with.
begin;

insert into public.colors (name, hex_value, sort_order, owner_category_id)
select v.name, v.hex, v.sort, 3
from (values
  ('Green Nano', '#2E9E5B', 1),
  ('Blue Nano #113', '#1F3F9A', 2),
  ('Blue Nano #114', '#2A5DB8', 3),
  ('Aqua Blue Nano #142', '#2BA3B8', 4),
  ('Black Nano', '#151515', 5)
) as v(name, hex, sort)
where not exists (select 1 from public.colors c where c.owner_category_id = 3 and c.name = v.name);

delete from public.category_colors cc
where cc.category_id = 3
  and cc.color_id not in (select id from public.colors where owner_category_id = 3);

-- A hot-selling flag on a colour Nano no longer offers.
delete from public.hot_selling_options h
where h.category_id = 3 and h.kind = 'color'
  and h.option_id not in (select id from public.colors where owner_category_id = 3);

insert into public.category_colors (category_id, color_id)
select 3, c.id from public.colors c
where c.owner_category_id = 3
  and not exists (select 1 from public.category_colors x where x.category_id = 3 and x.color_id = c.id);

commit;
