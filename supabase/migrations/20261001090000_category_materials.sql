-- Category-only options, for Semi Precious Beads (category 45) first.
--
-- 1. categories.option_label: what the "Color" field is called for this
--    category ("Material" for Semi Precious Beads). NULL keeps "Color".
-- 2. colors.owner_category_id / shapes.owner_category_id: a colour (here, a
--    bead material such as Rose Quartz) or shape that belongs to ONE category.
--    It is left off the shared Colors / Shapes pages and other categories'
--    pickers, and renaming it can't change any other category. Names only
--    need to be unique among shared rows, or within the owning category --
--    so the bead "Amethyst" can sit beside the CZ colour "Amethyst", and the
--    bead "Heart" beside the shared "Heart".
-- 3. category_size_colors: which colours/materials a shape+size carries in a
--    category. A category with no rows here keeps today's rule (every colour
--    with every size); a category with rows only offers those combinations.
BEGIN;

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS option_label text
  CHECK (option_label IS NULL OR length(btrim(option_label)) BETWEEN 1 AND 40);

ALTER TABLE public.colors ADD COLUMN IF NOT EXISTS owner_category_id integer
  REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS owner_category_id integer
  REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.colors DROP CONSTRAINT IF EXISTS colors_name_key;
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS colors_shared_name_key ON public.colors (name) WHERE owner_category_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS colors_owned_name_key ON public.colors (owner_category_id, name) WHERE owner_category_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shapes_shared_name_key ON public.shapes (name) WHERE owner_category_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shapes_owned_name_key ON public.shapes (owner_category_id, name) WHERE owner_category_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.category_size_colors (
  category_id integer NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  shape_size_id integer NOT NULL REFERENCES public.shape_sizes(id) ON DELETE CASCADE,
  color_id integer NOT NULL REFERENCES public.colors(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, shape_size_id, color_id)
);
CREATE INDEX IF NOT EXISTS category_size_colors_color_idx ON public.category_size_colors (color_id);

ALTER TABLE public.category_size_colors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS category_size_colors_public_read ON public.category_size_colors;
CREATE POLICY category_size_colors_public_read ON public.category_size_colors FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.category_size_colors TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.category_size_colors FROM anon, authenticated;
GRANT ALL ON public.category_size_colors TO service_role;

COMMIT;
