-- Baguette Princess's own gemstone photo (it had none), from the owner's photo.
update public.shapes set ref_photo_url = '/reference/stones/baguette-princess.webp'
where id = 33 and name = 'Baguette Princess' and ref_photo_url is null;
