-- Admin-only website settings: the private catalogue link and the WhatsApp
-- reply the owner sends to a catalogue request. These must never be public,
-- so they cannot live in `settings` or in page content (both anon-readable).
--
-- Additive and repeat-safe. No anonymous or signed-in access at all; only the
-- server (service role) reads and writes it.

BEGIN;

CREATE TABLE IF NOT EXISTS public.site_private_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_private_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.site_private_settings FROM anon, authenticated;
  END IF;
END $$;

-- Starting reply; the owner adds the catalogue link in admin.
INSERT INTO public.site_private_settings (key, value)
VALUES ('lead_reply', jsonb_build_object(
  'catalogue_link', '',
  'message', E'Hi {first_name}, thank you for your catalogue request to YOYO GEMS.\n\nHere is our digital catalogue: {link}\n\nSend us the shapes, sizes, colours and quantities you need and we will confirm stock and price.'
))
ON CONFLICT (key) DO NOTHING;

-- Finding an earlier request from the same number (repeat submissions are
-- merged into one lead instead of piling up).
CREATE INDEX IF NOT EXISTS site_leads_whatsapp_recent ON public.site_leads (whatsapp, created_at DESC);

COMMIT;
