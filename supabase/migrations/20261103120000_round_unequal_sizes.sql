-- Round and Round Checker listed oval sizes (3x4, 5x7, 10x14...) in 15
-- categories, so a buyer choosing Round saw a mix of every size (owner,
-- 2026-11-03). Each of those categories already lists the same sizes under
-- Oval, so only the Round links go; the master sizes stay for order history.
-- Coin Stone (49) has no Oval and is left for the owner to decide.
begin;

delete from category_shape_sizes css
using shape_sizes ss, shapes s
where ss.id = css.shape_size_id
  and s.id = ss.shape_id
  and s.name in ('Round', 'Round Checker')
  and ss.size_mm ~ '^\s*[0-9.]+\s*[x×*]\s*[0-9.]+\s*$'
  and split_part(regexp_replace(ss.size_mm, '\s*[x×*]\s*', 'x'), 'x', 1)::numeric
   <> split_part(regexp_replace(ss.size_mm, '\s*[x×*]\s*', 'x'), 'x', 2)::numeric
  and css.category_id <> 49;

commit;
