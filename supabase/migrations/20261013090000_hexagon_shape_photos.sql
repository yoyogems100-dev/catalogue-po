-- Hexagon and Hexagon Step Cut had no reference photo. Both use the owner's
-- step-cut hexagon photo. Only fills an empty photo, so a photo set in admin
-- since is kept.

update public.shapes set ref_photo_url = '/reference/stones/hexagon.webp'
where id in (18, 58) and name in ('Hexagon', 'Hexagon Step Cut') and ref_photo_url is null;
