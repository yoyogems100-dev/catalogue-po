-- Hole Punched Stones: the admin drills holes into a shape's gemstone photo
-- (Admin > Categories > Hole Punched > Shapes > Drill holes). What was drilled
-- is kept on the category's shape link so it can be moved or erased later:
--   { "base": photo the holes were drilled into,
--     "holes": [{ "x", "y", "r" }]   -- fractions of the photo,
--     "backdrop": "black" | "white"  -- the light box of its explore photo,
--     "photoId": that explore photo }
alter table public.category_shapes add column if not exists drill jsonb;

-- Eight Diagram's own gemstone photo (it had none).
update public.shapes set ref_photo_url = '/reference/stones/eight-diagram.webp'
where id = 15 and name = 'Eight Diagram' and ref_photo_url is null;

-- Hexagon Princess Cut: a new shared shape, in Hole Punched Stones.
insert into public.shapes (name, icon_key, sort_order, ref_photo_url)
select 'Hexagon Princess Cut', 'hexagon', 35, '/reference/stones/hexagon-princess-cut.webp'
where not exists (select 1 from public.shapes where name = 'Hexagon Princess Cut');

insert into public.category_shapes (category_id, shape_id)
select 20, s.id from public.shapes s
where s.name = 'Hexagon Princess Cut'
  and not exists (select 1 from public.category_shapes cs where cs.category_id = 20 and cs.shape_id = s.id);

-- Both drilled for Hole Punched, with one hole near the top.
update public.category_shapes cs
set ref_photo_url = v.drilled, reference_style = 'photo',
    drill = jsonb_build_object('base', v.base, 'holes', jsonb_build_array(jsonb_build_object('x', 0.5, 'y', v.y, 'r', 0.055)), 'backdrop', null, 'photoId', null)
from (values
  ('Eight Diagram', '/reference/stones/eight-diagram.webp', '/reference/hole-punched/eight-diagram.webp', 0.16),
  ('Hexagon Princess Cut', '/reference/stones/hexagon-princess-cut.webp', '/reference/hole-punched/hexagon-princess-cut.webp', 0.17)
) as v(name, base, drilled, y), public.shapes s
where s.name = v.name and cs.shape_id = s.id and cs.category_id = 20 and cs.ref_photo_url is null;
