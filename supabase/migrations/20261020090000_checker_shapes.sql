-- Four checker (checkerboard) cuts, drawn from the round, pear, oval and
-- marquise outlines with a checkerboard crown (lib/three-view.ts), and
-- offered in Hole Punched Stones (category 20). Each sorts right after its
-- base shape. Repeat-safe: an existing shape of the same name is reused.
begin;

insert into shapes (name, icon_key, sort_order)
select v.name, v.icon_key, coalesce((select b.sort_order from shapes b where b.name = v.base and b.owner_category_id is null limit 1), 0)
from (values
  ('Round Checker',    'round-checker',    'Round'),
  ('Pear Checker',     'pear-checker',     'Pear'),
  ('Oval Checker',     'oval-checker',     'Oval'),
  ('Marquise Checker', 'marquise-checker', 'Marquise')
) as v(name, icon_key, base)
where not exists (select 1 from shapes s where lower(s.name) = lower(v.name));

insert into category_shapes (category_id, shape_id)
select 20, s.id from shapes s
where s.name in ('Round Checker', 'Pear Checker', 'Oval Checker', 'Marquise Checker')
on conflict (category_id, shape_id) do nothing;

commit;
