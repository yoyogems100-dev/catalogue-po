-- Nano's five colours get real round stone photos (public/reference/colors/nano/).
-- Black Nano reuses the Black CZ stone. Only rows still without a photo change,
-- so a photo uploaded in admin is never overwritten.
begin;
update colors c set ref_photo_url = v.url
from (values
  ('Green Nano',          '/reference/colors/nano/green.webp'),
  ('Blue Nano #113',      '/reference/colors/nano/blue-113.webp'),
  ('Blue Nano #114',      '/reference/colors/nano/blue-114.webp'),
  ('Aqua Blue Nano #142', '/reference/colors/nano/aqua-142.webp'),
  ('Black Nano',          '/reference/colors/nano/black.webp')
) as v(name, url)
where c.name = v.name and c.owner_category_id = 3 and c.ref_photo_url is null;
commit;
