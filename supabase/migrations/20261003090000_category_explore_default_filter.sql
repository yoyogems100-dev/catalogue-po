-- The filter a category's Explore Photos tab opens with.
--
-- null (every existing category) keeps today's behaviour: all photos shown.
-- When set, it is a small JSON object chosen in Admin > Category > Photos,
-- e.g. {"shape_id": 3, "color_id": 12, "size_key": "4x6", "tag_id": null}.
-- Customers can still clear it or pick anything else; it is only where the
-- page starts. Readable through the existing public categories policy.
--
-- Additive and repeat-safe.

begin;

alter table public.categories add column if not exists explore_default_filter jsonb;

alter table public.categories drop constraint if exists categories_explore_default_filter_object;
alter table public.categories add constraint categories_explore_default_filter_object
  check (explore_default_filter is null or jsonb_typeof(explore_default_filter) = 'object');

commit;
