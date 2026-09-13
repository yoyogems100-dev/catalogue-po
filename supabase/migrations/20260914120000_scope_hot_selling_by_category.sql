-- Hot-selling options describe demand within one gemstone category.
ALTER TABLE public.hot_selling_options
  ADD COLUMN IF NOT EXISTS category_id bigint REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.hot_selling_options DROP CONSTRAINT IF EXISTS hot_selling_options_pkey;

-- Preserve older global flags by copying them to every category where that
-- option is currently available. Future edits are category-specific.
INSERT INTO public.hot_selling_options (category_id, kind, option_id)
SELECT DISTINCT link.category_id, old.kind, old.option_id
FROM public.hot_selling_options AS old
JOIN (
  SELECT category_id, 'shape'::text AS kind, shape_id::bigint AS option_id FROM public.category_shapes
  UNION ALL
  SELECT category_id, 'color', color_id::bigint FROM public.category_colors
  UNION ALL
  SELECT category_id, 'size', shape_size_id::bigint FROM public.category_shape_sizes
  UNION ALL
  SELECT category_id, 'tag', tag_id::bigint FROM public.category_tags
) AS link ON link.kind = old.kind AND link.option_id = old.option_id
WHERE old.category_id IS NULL;

DELETE FROM public.hot_selling_options WHERE category_id IS NULL;

ALTER TABLE public.hot_selling_options ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE public.hot_selling_options
  ADD CONSTRAINT hot_selling_options_pkey PRIMARY KEY (category_id, kind, option_id);

CREATE INDEX IF NOT EXISTS hot_selling_options_category_idx
  ON public.hot_selling_options (category_id, kind, option_id);
