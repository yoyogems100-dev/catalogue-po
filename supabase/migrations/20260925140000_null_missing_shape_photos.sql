-- Clear ref_photo_url on nine shapes whose recorded photo file was never in
-- the repo (they rendered as broken images in shape pickers, the category
-- workspace and the public site). No owner-provided photo exists for any of
-- them, so rather than borrow another shape's picture they fall back to their
-- vector icon until a real photo is supplied.
--
-- Each row is matched on id AND its exact broken path, so a photo uploaded
-- through the admin in the meantime is left alone, and rerunning is a no-op.

begin;

update public.shapes s
set ref_photo_url = null
from (values
  (10, '/reference/stones/d-cut-shape.webp'),        -- D-Cut Shape
  (13, '/reference/stones/hexagon-queen-cut.webp'),  -- Hexagon Queen Cut
  (15, '/reference/stones/eight-diagram.webp'),      -- Eight Diagram
  (18, '/reference/stones/hexagon-step-cut.webp'),   -- Hexagon Step Cut
  (22, '/reference/stones/gourd.webp'),              -- Gourd
  (24, '/reference/stones/long-diamond-cut.webp'),   -- Long Diamond Cut
  (26, '/reference/stones/diamond-shape.webp'),      -- Diamond Shape
  (28, '/reference/stones/special-pear.webp'),       -- Special Pear
  (33, '/reference/stones/baguette-princess.webp')   -- Baguette Princess
) as broken(id, path)
where s.id = broken.id
  and s.ref_photo_url = broken.path;

commit;
