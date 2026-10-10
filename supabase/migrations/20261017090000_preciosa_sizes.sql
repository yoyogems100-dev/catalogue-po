-- Preciosa price list (Preciosa_INR Pricelist_wef 1st June 2021.pdf): sizes for shapes
-- the Excellent Star list doesn't cover, as the owner asked on 2026-10-10.
--   Taper Baguette -> Tapered Baguette (Hole Punched, 3A Quality CZ)
--   Octagon        -> Octagon (3A); Emerald Cut (7A, 4A, 5A) -- owner's stand-in
--   Square         -> Princess (3A, 4A, 5A) -- owner's stand-in; Preciosa's square is a princess cut
-- Preciosa writes length first (4x2); stored small-first like the catalogue (2x4).
-- Only adds; sizes a category already offers (any spelling) are skipped.
begin;
insert into public.shape_sizes (shape_id, size_mm)
select v.shape_id, v.size_mm from (values
  (82, '3.5x2.5x1.5'),
  (63, '2x4'),
  (71, '1.2x1.2'),
  (71, '1.3x1.3')
) as v(shape_id, size_mm)
where not exists (select 1 from public.shape_sizes s where s.shape_id = v.shape_id and s.size_mm = v.size_mm);
insert into public.category_shape_sizes (category_id, shape_size_id)
select v.category_id, (select min(s.id) from public.shape_sizes s where s.shape_id = v.shape_id and s.size_mm = v.size_mm)
from (values
  (20, 82, '2x1.5x1'),
  (20, 82, '2.5x1.5x1'),
  (20, 82, '2.5x2x1.5'),
  (20, 82, '3x2x1'),
  (20, 82, '3x2.5x1.5'),
  (20, 82, '3.5x1.5x1'),
  (20, 82, '3.5x2.5x1.5'),
  (20, 82, '4x2x1.5'),
  (35, 82, '2x1.5x1'),
  (35, 82, '2.5x1.5x1'),
  (35, 82, '2.5x2x1.5'),
  (35, 82, '3x2x1'),
  (35, 82, '3x2.5x1.5'),
  (35, 82, '3.5x1.5x1'),
  (35, 82, '3.5x2.5x1.5'),
  (35, 82, '4x2x1.5'),
  (35, 63, '2x4'),
  (35, 71, '1.2x1.2'),
  (35, 71, '1.3x1.3'),
  (35, 71, '1.4x1.4'),
  (35, 71, '3.5x3.5'),
  (35, 71, '4x4'),
  (35, 71, '4.5x4.5'),
  (35, 71, '5x5'),
  (35, 71, '5.5x5.5'),
  (35, 71, '6x6'),
  (35, 71, '7x7'),
  (35, 71, '8x8'),
  (36, 71, '1.2x1.2'),
  (36, 71, '1.25'),
  (36, 71, '1.3x1.3'),
  (36, 71, '1.4x1.4'),
  (36, 71, '1.5x1.5'),
  (36, 71, '1.75'),
  (36, 71, '2x2'),
  (36, 71, '2.5x2.5'),
  (36, 71, '2.75'),
  (36, 71, '3x3'),
  (36, 71, '3.5x3.5'),
  (36, 71, '4x4'),
  (36, 71, '4.5x4.5'),
  (36, 71, '5x5'),
  (36, 71, '5.5x5.5'),
  (36, 71, '6x6'),
  (36, 71, '7x7'),
  (36, 71, '8x8'),
  (37, 71, '1.2x1.2'),
  (37, 71, '1.3x1.3'),
  (37, 71, '1.4x1.4'),
  (37, 71, '1.75'),
  (37, 71, '2.5x2.5'),
  (37, 71, '2.75'),
  (37, 71, '3.5x3.5'),
  (37, 71, '4.5x4.5'),
  (37, 71, '5.5x5.5'),
  (37, 71, '6x6'),
  (37, 71, '7x7'),
  (32, 54, '2x4'),
  (32, 54, '3x5'),
  (32, 54, '4x6'),
  (32, 54, '5x7'),
  (37, 54, '2x4'),
  (37, 54, '3x5')
) as v(category_id, shape_id, size_mm)
where not exists (select 1 from public.category_shape_sizes x where x.category_id = v.category_id
  and x.shape_size_id = (select min(s.id) from public.shape_sizes s where s.shape_id = v.shape_id and s.size_mm = v.size_mm));
commit;
