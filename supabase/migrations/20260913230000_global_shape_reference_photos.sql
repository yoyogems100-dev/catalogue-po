-- Global default reference photo per shape (e.g. the Moissanite gemstone photos),
-- used as a fallback wherever a category hasn't uploaded its own shape photo.
-- category_shapes.ref_photo_url remains a per-category override.
alter table shapes add column if not exists ref_photo_url text;

update shapes set ref_photo_url = v.path
from (values
  (1,  '/moissanite-shapes/round.png'),
  (4,  '/moissanite-shapes/marquise.png'),
  (5,  '/moissanite-shapes/trillion.png'),
  (6,  '/moissanite-shapes/cushion.png'),
  (7,  '/moissanite-shapes/asscher.png'),
  (9,  '/moissanite-shapes/triangle.png'),
  (23, '/moissanite-shapes/heart.png'),
  (31, '/moissanite-shapes/trapezoid.png'),
  (32, '/moissanite-shapes/baguette.png'),
  (49, '/moissanite-shapes/long-cushion.png'),
  (54, '/moissanite-shapes/emerald.png'),
  (66, '/moissanite-shapes/oval.png'),
  (68, '/moissanite-shapes/pear.png'),
  (71, '/moissanite-shapes/princess.png'),
  (72, '/moissanite-shapes/radiant.png')
) as v(id, path)
where shapes.id = v.id;
