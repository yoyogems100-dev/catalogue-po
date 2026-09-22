-- Colour price groups belong to a category.
--
-- They were global, and the shared colours gave that away. "Colorless /
-- White" is linked to twenty categories, and it sits in a group called
-- "Swiss Heavy Round" that was made for Swiss High Density CZ. So every one
-- of those twenty priced under a heading naming a shape from a different
-- category -- a label that never changed no matter which category was open.
-- The seven Crushed Ice groups leaked the same way wherever their colours
-- were reused.
--
-- A null category_id still means global, so a group really shared across the
-- catalogue stays possible; nothing today is one.

alter table color_price_groups
  add column if not exists category_id integer references categories(id) on delete cascade;

-- Backfill from the prices themselves: a group that has only ever been priced
-- under one category belongs to it. Guarded on category_id is null, so this is
-- repeat-safe and never overwrites a scope set later by hand.
update color_price_groups g
set category_id = p.category_id
from (
  select price_group_id, min(category_id) as category_id
  from shape_size_prices
  group by price_group_id
  having count(distinct category_id) = 1
) p
where p.price_group_id = g.id and g.category_id is null and not g.is_catch_all;

-- A group with no prices yet but whose colours are used by exactly one
-- category belongs to that category too -- this is Moissanite's White (DEF),
-- which the owner enters prices under and which has no other home.
update color_price_groups g
set category_id = m.category_id
from (
  select gm.group_id, min(cc.category_id) as category_id
  from color_price_group_members gm
  join category_colors cc on cc.color_id = gm.color_id
  group by gm.group_id
  having count(distinct cc.category_id) = 1
) m
where m.group_id = g.id and g.category_id is null and not g.is_catch_all;
