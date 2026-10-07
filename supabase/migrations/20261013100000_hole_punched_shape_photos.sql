-- Hole Punched Stones (category 20): each shape shows the real drilled stone,
-- cropped from the category's own explore photos and turned upright, instead
-- of the shared undrilled shape photo. Category-only (category_shapes), and
-- only where no category photo is set yet.

update public.category_shapes cs
set ref_photo_url = v.url, reference_style = 'photo'
from (values
  (66, '/reference/hole-punched/oval.webp'),
  (68, '/reference/hole-punched/pear.webp'),
  (23, '/reference/hole-punched/heart.webp'),
  (54, '/reference/hole-punched/emerald-cut.webp'),
  (9,  '/reference/hole-punched/triangle.webp'),
  (82, '/reference/hole-punched/tapered-baguette.webp'),
  (3,  '/reference/hole-punched/square.webp'),
  (4,  '/reference/hole-punched/marquise.webp')
) as v(shape_id, url)
where cs.category_id = 20 and cs.shape_id = v.shape_id and cs.ref_photo_url is null;
