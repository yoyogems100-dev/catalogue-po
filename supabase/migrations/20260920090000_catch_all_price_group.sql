-- A price for a category that does not price by colour.
--
-- Every price is stored against a colour GROUP, because the supplier sheets
-- this was built from are laid out that way. But most categories here have no
-- colour-based price split at all: Ruby Synthetic has two colours, both in no
-- group, so the pricing table rendered with a Size column and no price column
-- -- there was literally nowhere to type a price. Nano has fifty-five colours
-- of which exactly one happens to sit in a group called "Swiss Heavy Round",
-- so the whole category priced under that one misleading heading.
--
-- price_group_id is part of the primary key and so cannot be null. Instead
-- there is one reserved group that means "every colour in this category that
-- has no group of its own". The admin table shows it as a single "Price"
-- column when the category has no real groups, and as "All other colors"
-- beside the real ones when it has some.
--
-- Repeat-safe: the column is added only if absent and the row is keyed on the
-- flag, so re-running this changes nothing.

alter table color_price_groups
  add column if not exists is_catch_all boolean not null default false;

-- Partial unique index: exactly one catch-all group can ever exist, so code
-- can look it up without guessing at a name or an id.
create unique index if not exists color_price_groups_one_catch_all
  on color_price_groups ((true)) where is_catch_all;

insert into color_price_groups (name, sort_order, is_catch_all)
select 'All other colors', 1000, true
where not exists (select 1 from color_price_groups where is_catch_all);
