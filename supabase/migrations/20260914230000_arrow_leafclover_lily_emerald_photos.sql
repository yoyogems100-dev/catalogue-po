-- Fix Arrow, Leaf Clover and Lily, which had a ref_photo_url on record
-- pointing to a file that was never actually present in the repo (rendered
-- as a broken image everywhere). Also swaps in a sharper Emerald Cut photo
-- (the owner flagged some gemstone images as unclear) -- Cushion and
-- Cushion Elongated got the same quality upgrade but keep their existing
-- file paths (moissanite-shapes/cushion.png, long-cushion.png), so no row
-- update is needed for those two.

update public.shapes set ref_photo_url = '/reference/stones/arrow.webp' where name = 'Arrow';
update public.shapes set ref_photo_url = '/reference/stones/leaf-clover.webp' where name = 'Leaf Clover';
update public.shapes set ref_photo_url = '/reference/stones/lily.webp' where name = 'Lily';
update public.shapes set ref_photo_url = '/reference/stones/emerald-cut.webp' where name = 'Emerald Cut';
