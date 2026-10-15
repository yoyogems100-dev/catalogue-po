-- A shape linked to a category starts with its sizes (owner, 2026-10-15):
-- every size the shape has in the catalogue (Admin > Shapes), each value
-- once -- 4, 4.0 and 4.00 mm, or 3x3 and 3, are one size. Only a shape with
-- no sizes in that category gets them; a category whose sizes were set for
-- it keeps exactly those, and sizes removed there later stay removed.
--
-- 1. size_value_key(): the value a size stands for (lib/size-options sizeKey).
-- 2. The four checker cuts get their base shape's sizes (mm only, no weights).
-- 3. A trigger links the sizes whenever a shape is linked to a category.
-- 4. Every shape already linked without any sizes gets them now.
-- Repeat-safe. Run after 20261020090000_checker_shapes.sql.
begin;

create or replace function public.size_value_key(v text) returns text
language sql immutable as $$
  with r as (
    select regexp_replace(regexp_replace(regexp_replace(trim(v), '\s*mm\s*$', '', 'i'), '[×*X]', 'x', 'g'), '\s+', '', 'g') as raw
  )
  select case
    when raw !~ '^\d+(\.\d+)?(x\d+(\.\d+)?)*$' then lower(raw)
    else (
      select case when count(distinct x) = 1 then min(x) else string_agg(x, 'x' order by ord) end
      from (select trim_scale(part::numeric)::text as x, ord
            from unnest(string_to_array(raw, 'x')) with ordinality as u(part, ord)) parts
    )
  end
  from r
$$;

-- 2. Checker cuts: the base shape's sizes, each value once.
insert into shape_sizes (shape_id, size_mm)
select c.id, b.size_mm
from (values ('Round Checker', 'Round'), ('Pear Checker', 'Pear'), ('Oval Checker', 'Oval'), ('Marquise Checker', 'Marquise')) as v(checker, base)
join shapes c on c.name = v.checker and c.owner_category_id is null
join lateral (
  select distinct on (public.size_value_key(ss.size_mm)) ss.size_mm
  from shapes bs join shape_sizes ss on ss.shape_id = bs.id
  where bs.name = v.base and bs.owner_category_id is null
  order by public.size_value_key(ss.size_mm), ss.id
) b on true
where not exists (select 1 from shape_sizes have where have.shape_id = c.id);

-- 3. Link a shape's sizes to a category that has none for it.
create or replace function public.link_default_shape_sizes(p_category_id integer, p_shape_id integer) returns integer
language plpgsql security definer set search_path = public as $$
declare added integer;
begin
  if exists (
    select 1 from category_shape_sizes css join shape_sizes ss on ss.id = css.shape_size_id
    where css.category_id = p_category_id and ss.shape_id = p_shape_id
  ) then return 0; end if;
  insert into category_shape_sizes (category_id, shape_size_id)
  select p_category_id, first.id
  from (
    select distinct on (public.size_value_key(ss.size_mm)) ss.id
    from shape_sizes ss where ss.shape_id = p_shape_id
    order by public.size_value_key(ss.size_mm), ss.id
  ) first
  on conflict (category_id, shape_size_id) do nothing;
  get diagnostics added = row_count;
  return added;
end $$;

create or replace function public.category_shapes_default_sizes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.link_default_shape_sizes(new.category_id, new.shape_id);
  return new;
end $$;

drop trigger if exists category_shapes_default_sizes on category_shapes;
create trigger category_shapes_default_sizes after insert on category_shapes
for each row execute function public.category_shapes_default_sizes();

-- 4. Shapes already linked without sizes.
select public.link_default_shape_sizes(cs.category_id, cs.shape_id) from category_shapes cs;

commit;
