-- Set reference photos for two shapes that previously had none.
update public.shapes set ref_photo_url = '/reference/stones/tapered-baguette.webp' where name = 'Tapered Baguette' and ref_photo_url is null;
update public.shapes set ref_photo_url = '/reference/stones/old-european-cut.webp' where name = 'Old European Cut' and ref_photo_url is null;
