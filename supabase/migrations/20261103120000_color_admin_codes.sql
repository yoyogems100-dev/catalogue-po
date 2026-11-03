-- The owner's own code for a colour (YOTCF-05 is "#39" to them), shown only
-- in admin while placing and handling orders: "YOTCF-05 (#39)". Buyers,
-- invoices, PDFs and WhatsApp messages keep the plain colour name.
--
-- A table of its own, not a column on colors: colors is readable by anyone
-- with the public key, and these codes must not be. No anonymous or
-- signed-in access; only the server (service role) reads and writes it.
-- Additive and repeat-safe; a code changed later in admin is never
-- overwritten.

BEGIN;

CREATE TABLE IF NOT EXISTS public.color_admin_codes (
  color_id   integer PRIMARY KEY REFERENCES public.colors(id) ON DELETE CASCADE,
  code       text NOT NULL CHECK (length(code) BETWEEN 1 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.color_admin_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.color_admin_codes FROM anon, authenticated;
  END IF;
END $$;

-- YOTCF (category 47), from the owner's code sheet (YOTCF-1 to YOTCF-17;
-- 18 onward weren't legible on it and are added in admin).
INSERT INTO public.color_admin_codes (color_id, code)
SELECT c.id, v.code
FROM (VALUES
  ('YOTCF-01', '1405'), ('YOTCF-02', '1398'), ('YOTCF-03', '3125'), ('YOTCF-04', '3047'),
  ('YOTCF-05', '39'),   ('YOTCF-06', '6025'), ('YOTCF-07', '2533'), ('YOTCF-08', '2593'),
  ('YOTCF-09', '38'),   ('YOTCF-10', '2477'), ('YOTCF-11', '2860'), ('YOTCF-12', '2850'),
  ('YOTCF-13', '2755'), ('YOTCF-14', '37'),   ('YOTCF-15', '2793'), ('YOTCF-16', '3048'),
  ('YOTCF-17', '1103')
) AS v(name, code)
JOIN public.colors c ON c.name = v.name AND c.owner_category_id = 47
ON CONFLICT (color_id) DO NOTHING;

COMMIT;
