BEGIN;
CREATE TABLE IF NOT EXISTS public.hot_selling_options (
  kind text NOT NULL CHECK (kind IN ('color','shape','size','tag')),
  option_id bigint NOT NULL CHECK (option_id > 0),
  PRIMARY KEY (kind, option_id)
);
ALTER TABLE public.hot_selling_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hot_selling_public_read ON public.hot_selling_options;
CREATE POLICY hot_selling_public_read ON public.hot_selling_options FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.hot_selling_options TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.hot_selling_options FROM anon, authenticated;
GRANT ALL ON public.hot_selling_options TO service_role;
COMMIT;
