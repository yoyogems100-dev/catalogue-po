-- Crushed Ice Cut (category 1): the owner's "Ice Cut G Series Prices" sheet
-- (2026-10-17) replaces the category's earlier price columns.
--
-- The sheet prices by colour code in five columns, A..E, and by size in two
-- shape families that share one price per row:
--   Octagon / Oval / Pear          2x3 .. 10x14
--   Square / Heart / Cushion / Round   4x4 .. 12x12 (Round 4 = 4mm)
-- Marquise is not on the sheet and stays unpriced.
--
-- Nothing is deleted except the G colours' memberships in the category's
-- earlier groups (so each colour has one price column). Those groups and
-- their saved prices stay in the database untouched; they simply have no
-- colour of this category left, so no column shows for them.
-- Sizes and colour links are additive only (see the catalogue union rule).
begin;

-- 1. The five price columns.
insert into color_price_groups (name, sort_order, category_id) values
  ('G-Series A · White D', 101, 1),
  ('G-Series B', 102, 1),
  ('G-Series C', 103, 1),
  ('G-Series D', 104, 1),
  ('G-Series E', 105, 1)
on conflict (name) do update set sort_order = excluded.sort_order, category_id = excluded.category_id;

-- 2. Which colour codes are priced in which column, exactly as on the sheet.
create temporary table g_sheet_colors(code text primary key, group_name text not null) on commit drop;
insert into g_sheet_colors (code, group_name)
select code, 'G-Series A · White D' from unnest(array['G-40']) code
union all select code, 'G-Series B' from unnest(array[
  'G-01','G-02','G-07','G-08','G-12','G-13','G-14','G-15','G-16','G-41','G-43','G-44','G-53']) code
union all select code, 'G-Series C' from unnest(array[
  'G-03','G-04','G-84','G-05','G-23','G-24','G-42','G-45','G-46','G-55','G-56','G-57','G-58','G-59','G-66']) code
union all select code, 'G-Series D' from unnest(array[
  'G-17','G-18','G-19','G-20','G-21','G-25','G-26','G-30','G-31','G-32','G-33','G-34','G-35',
  'G-36','G-37','G-38','G-39','G-47','G-49','G-74','G-50','G-51','G-52','G-54','G-60','G-61','G-62','G-64']) code
union all select code, 'G-Series E' from unnest(array[
  'G-27','G-28','G-29','G-76','G-77','G-78','G-79','G-80']) code;

do $$
declare missing text;
begin
  select string_agg(s.code, ', ') into missing from g_sheet_colors s
  where not exists (select 1 from colors c where split_part(c.name, ' ', 1) = s.code and c.owner_category_id is null);
  if missing is not null then raise exception 'G colours not found: %', missing; end if;
end $$;

-- Every priced code is offered in the category (adds G-03, G-04, G-23, G-25,
-- G-26, G-29, G-43, G-47, G-50, G-51, G-62, G-64; the rest are already there).
insert into category_colors (category_id, color_id)
select 1, c.id from colors c join g_sheet_colors s on split_part(c.name, ' ', 1) = s.code
where c.owner_category_id is null
on conflict (category_id, color_id) do nothing;

-- One column per colour: drop the G colours' places in this category's
-- earlier groups, then put each into its sheet column.
delete from color_price_group_members m
using color_price_groups g, colors c
where m.group_id = g.id and m.color_id = c.id
  and g.category_id = 1 and g.name not like 'G-Series %'
  and c.name ~ '^G-[0-9]{2} ';

insert into color_price_group_members (group_id, color_id)
select g.id, c.id
from g_sheet_colors s
join colors c on split_part(c.name, ' ', 1) = s.code and c.owner_category_id is null
join color_price_groups g on g.name = s.group_name
on conflict (group_id, color_id) do nothing;

-- 3. Two sizes on the sheet the category didn't have yet.
insert into shape_sizes (shape_id, size_mm)
select v.shape_id, v.size_mm from (values (63, '2x3'), (3, '11x11')) v(shape_id, size_mm)
where not exists (select 1 from shape_sizes ss where ss.shape_id = v.shape_id and ss.size_mm = v.size_mm);

-- 4. The price grid: one row per sheet row, for each shape family.
create temporary table g_sheet_rows(oval_size text, square_size text, a numeric, b numeric, c numeric, d numeric, e numeric) on commit drop;
insert into g_sheet_rows values
  ('2x3',   null,   17,  19,  23,  41,  61),
  ('3x4',   null,   17,  19,  23,  41,  73),
  ('3x5',   '4',    17,  19,  23,  41,  81),
  ('4x6',   '5',    23,  25,  31,  51, 121),
  ('5x7',   '6',    27,  29,  37,  67, 171),
  ('6x8',   '7',    37,  41,  49,  91, 221),
  ('7x9',   '8',    45,  49,  61, 121, 301),
  ('8x10',  '9',    65,  73,  91, 171, 401),
  ('9x11',  '10',   85,  93, 111, 241, 541),
  ('10x12', '11',  111, 127, 145, 321, 701),
  ('10x14', '12',  141, 155, 171, 441, 961);

-- Shape ids: 63 Octagon, 66 Oval, 68 Pear | 3 Square, 23 Heart, 6 Cushion, 1 Round.
-- Round sizes are stored as "4.0".."12.0" in this category; the others as "4x4".
create temporary table g_sheet_cells on commit drop as
select sh.shape_id, r.oval_size as size_mm, r.a, r.b, r.c, r.d, r.e
from g_sheet_rows r cross join unnest(array[63, 66, 68]) sh(shape_id)
union all
select sh.shape_id, r.square_size || 'x' || r.square_size, r.a, r.b, r.c, r.d, r.e
from g_sheet_rows r cross join unnest(array[3, 23, 6]) sh(shape_id) where r.square_size is not null
union all
select 1, r.square_size || '.0', r.a, r.b, r.c, r.d, r.e
from g_sheet_rows r where r.square_size is not null;

-- Resolve each cell to exactly one size row: prefer the one this category
-- already links, else the lowest id (Round has "4", "4.0" and "4.00").
create temporary table g_sheet_sizes on commit drop as
select distinct on (cell.shape_id, cell.size_mm) cell.*, ss.id as shape_size_id
from g_sheet_cells cell
join shape_sizes ss on ss.shape_id = cell.shape_id and ss.size_mm = cell.size_mm
left join category_shape_sizes css on css.category_id = 1 and css.shape_size_id = ss.id
order by cell.shape_id, cell.size_mm, (css.shape_size_id is null), ss.id;

do $$
begin
  if (select count(*) from g_sheet_sizes) <> (select count(*) from g_sheet_cells) then
    raise exception 'Expected % sheet sizes, resolved %', (select count(*) from g_sheet_cells), (select count(*) from g_sheet_sizes);
  end if;
end $$;

insert into category_shapes (category_id, shape_id)
select distinct 1, shape_id from g_sheet_sizes
on conflict do nothing;

insert into category_shape_sizes (category_id, shape_size_id)
select 1, shape_size_id from g_sheet_sizes
on conflict do nothing;

insert into shape_size_prices (category_id, shape_id, shape_size_id, price_group_id, price_inr, price_rmb)
select 1, s.shape_id, s.shape_size_id, g.id,
  case g.name when 'G-Series A · White D' then s.a when 'G-Series B' then s.b
              when 'G-Series C' then s.c when 'G-Series D' then s.d else s.e end,
  null
from g_sheet_sizes s
cross join color_price_groups g
where g.name like 'G-Series %' and g.category_id = 1
on conflict (category_id, shape_id, shape_size_id, price_group_id)
do update set price_inr = excluded.price_inr, price_rmb = null;

commit;
