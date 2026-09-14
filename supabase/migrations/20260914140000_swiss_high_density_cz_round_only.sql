-- Restrict Swiss High Density CZ (category 39) to Round only, and load the
-- shapes, sizes and per-piece pricing from the owner's Swiss Heavy CZ price list.
-- Removes the mismatched fancy-shape sizes that were seeded for this category
-- and were never correct for a round-only, mm-diameter product line.

delete from public.category_shape_sizes where category_id = 39;
delete from public.category_shapes where category_id = 39 and shape_id <> 1;

-- Two sizes on the price list (1.05mm, 1.15mm) don't exist yet for Round.
insert into public.shape_sizes (shape_id, size_mm)
select 1, v.size_mm
from (values ('1.05'), ('1.15')) as v(size_mm)
where not exists (
  select 1 from public.shape_sizes where shape_id = 1 and size_mm = v.size_mm
);

insert into public.category_shape_sizes (category_id, shape_size_id)
select 39, sz.id
from public.shape_sizes sz
where sz.shape_id = 1
  and sz.size_mm in (
    '0.90','1.00','1.05','1.10','1.15','1.20','1.25','1.30','1.40','1.50',
    '1.60','1.70','1.75','1.80','1.90','2.00','2.10','2.25','2.50','2.75',
    '3.00','3.25','3.50','3.75','4.00','4.50','5.00','5.50','6.00','6.50','7.00'
  )
on conflict do nothing;

-- Dedicated price group for this product line's own White stone, kept
-- separate from Moissanite's "White (DEF)" group (different color record).
insert into public.color_price_groups (name)
select 'Swiss Heavy Round'
where not exists (select 1 from public.color_price_groups where name = 'Swiss Heavy Round');

insert into public.color_price_group_members (group_id, color_id)
select g.id, 1
from public.color_price_groups g
where g.name = 'Swiss Heavy Round'
on conflict do nothing;

insert into public.shape_size_prices (category_id, shape_id, shape_size_id, price_group_id, price_rmb)
select 39, 1, sz.id, g.id, v.rate_per_pc
from public.shape_sizes sz
join (values
  ('0.90', 0.75),  ('1.00', 0.85),  ('1.05', 0.95),  ('1.10', 1.00),  ('1.15', 1.10),
  ('1.20', 1.15),  ('1.25', 1.25),  ('1.30', 1.40),  ('1.40', 1.80),  ('1.50', 1.90),
  ('1.60', 2.40),  ('1.70', 2.85),  ('1.75', 3.10),  ('1.80', 3.35),  ('1.90', 3.75),
  ('2.00', 4.30),  ('2.10', 4.65),  ('2.25', 5.40),  ('2.50', 7.50),  ('2.75', 9.30),
  ('3.00', 11.30), ('3.25', 14.50), ('3.50', 16.05), ('3.75', 19.05), ('4.00', 23.45),
  ('4.50', 32.15), ('5.00', 43.70), ('5.50', 53.80), ('6.00', 64.65), ('6.50', 82.05),
  ('7.00', 96.25)
) as v(size_mm, rate_per_pc) on v.size_mm = sz.size_mm
cross join public.color_price_groups g
where sz.shape_id = 1 and g.name = 'Swiss Heavy Round'
on conflict (category_id, shape_id, shape_size_id, price_group_id)
do update set price_rmb = excluded.price_rmb;
