-- Gemstone photos for shapes that had none, cut out of the Excellent Star
-- price list (EXCELLENT STAR PRICE LIST-1.pdf) with the black background
-- removed. Only fills an empty photo.
update public.shapes s set ref_photo_url = v.url
from (values
  (10, 'D-Cut Shape', '/reference/stones/d-cut-shape.webp'),
  (13, 'Hexagon Queen Cut', '/reference/stones/hexagon-queen-cut.webp'),
  (22, 'Gourd', '/reference/stones/gourd.webp'),
  (24, 'Long Diamond Cut', '/reference/stones/long-diamond-cut.webp'),
  (26, 'Diamond Shape', '/reference/stones/diamond-shape.webp'),
  (28, 'Special Pear', '/reference/stones/special-pear.webp')
) as v(id, name, url)
where s.id = v.id and s.name = v.name and s.ref_photo_url is null;
