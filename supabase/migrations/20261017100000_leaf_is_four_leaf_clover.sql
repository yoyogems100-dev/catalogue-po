-- "Leaf" is the four-leaf clover (owner, 2026-10-10): it shows the Leaf Clover
-- photo and the clover drawing instead of the lily one. Kept as its own shape
-- so the categories and orders that use it are untouched.
update public.shapes set icon_key = 'clover' where id = 62 and name = 'Leaf' and icon_key is distinct from 'clover';
update public.shapes set ref_photo_url = '/reference/stones/leaf-clover.webp' where id = 62 and name = 'Leaf' and ref_photo_url is null;
