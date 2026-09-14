-- Temporary placeholders per the owner's explicit request, until real
-- dedicated photos are available: Bucket Shape borrows Tapered Baguette's
-- photo, Octagon Princess and Octagon Step Cut borrow the plain Octagon
-- photo. These are stand-ins, not a claim that the shapes are identical --
-- revisit once real photos exist for these three.

update public.shapes set ref_photo_url = '/reference/stones/tapered-baguette.webp' where name = 'Bucket Shape';
update public.shapes set ref_photo_url = '/reference/stones/octagon.webp' where name = 'Octagon Princess';
update public.shapes set ref_photo_url = '/reference/stones/octagon.webp' where name = 'Octagon Step Cut';
