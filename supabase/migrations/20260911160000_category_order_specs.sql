BEGIN;
CREATE TABLE IF NOT EXISTS public.rainbow_strip_options (
 category_id integer NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
 shape_size_id integer NOT NULL REFERENCES public.shape_sizes(id) ON DELETE CASCADE,
 allowed_counts integer[] NOT NULL DEFAULT '{}',
 PRIMARY KEY(category_id,shape_size_id),
 CHECK (cardinality(allowed_counts)<=30 AND 0 < ALL(allowed_counts) AND 100000 >= ALL(allowed_counts))
);
ALTER TABLE public.rainbow_strip_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rainbow_options_read ON public.rainbow_strip_options;
CREATE POLICY rainbow_options_read ON public.rainbow_strip_options FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.rainbow_strip_options TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rainbow_strip_options FROM anon, authenticated;
GRANT ALL ON public.rainbow_strip_options TO service_role;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS order_specs jsonb;
-- A default/custom rainbow composition has no single color foreign key.
ALTER TABLE public.order_items ALTER COLUMN color_id DROP NOT NULL;
COMMIT;
