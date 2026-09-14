-- Real reference photos for two shapes that only had the generic vector:
-- "Octagon" (the plain entry, distinct from Octagon Princess/Step Cut/Eight
-- Diagram which already have their own photos) and "Drop".

update public.shapes set ref_photo_url = '/reference/stones/octagon.webp' where name = 'Octagon';
update public.shapes set ref_photo_url = '/reference/stones/drop.webp' where name = 'Drop';
