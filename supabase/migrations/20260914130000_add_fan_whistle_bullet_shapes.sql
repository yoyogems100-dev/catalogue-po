-- New master shapes requested by the owner. Not linked to any category yet;
-- link them from Admin > Categories > Shapes & sizes wherever they should appear.
insert into public.shapes (name, icon_key, ref_photo_url, sort_order)
select 'Fan', 'fan', '/reference/stones/fan.webp', 86
where not exists (select 1 from public.shapes where name = 'Fan');

insert into public.shapes (name, icon_key, ref_photo_url, sort_order)
select 'Whistle', 'whistle', '/reference/stones/whistle.webp', 87
where not exists (select 1 from public.shapes where name = 'Whistle');

insert into public.shapes (name, icon_key, ref_photo_url, sort_order)
select 'Bullet', 'bullet', '/reference/stones/bullet.webp', 88
where not exists (select 1 from public.shapes where name = 'Bullet');
