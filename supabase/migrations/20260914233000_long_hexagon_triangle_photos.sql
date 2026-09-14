-- Fix Long Hexagon, which had a ref_photo_url on record pointing to a file
-- that was never actually in the repo. Triangle's existing photo is
-- upgraded in place (moissanite-shapes/triangle.png keeps its path -- only
-- the pixel content changed), so no row update needed for it.

update public.shapes set ref_photo_url = '/reference/stones/long-hexagon.webp' where name = 'Long Hexagon';
