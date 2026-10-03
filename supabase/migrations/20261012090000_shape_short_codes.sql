-- Short codes for shapes (HS = Heart, OS = Oval, RD = Round, MQ = Marquise),
-- used in the WhatsApp order message so each line stays narrow on a phone.
-- Edited on Admin > Shapes; a shape with no code prints its full name.
-- Only fills codes that are still empty, so re-running never overwrites an
-- admin's edit.
begin;
alter table public.shapes add column if not exists short_code text;
update public.shapes set short_code = v.code
from (values ('Heart', 'HS'), ('Oval', 'OS'), ('Round', 'RD'), ('Marquise', 'MQ')) as v(name, code)
where shapes.name = v.name and (shapes.short_code is null or shapes.short_code = '');
commit;
