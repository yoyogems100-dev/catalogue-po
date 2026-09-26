-- The website keeps its own photographs, separate from the /po catalogue.
--
-- A website category's photos are the site_media rows linked to it
-- (target_type 'site_category'). Each photo's filter tags are further links:
-- 'color', 'shape', 'size' (catalogue ids) and, new here, 'grade'
-- (site_grades.id). Photos copied from /po remember where they came from in
-- source_photo_id -- deliberately not a foreign key, so deleting the /po photo
-- never removes the website's copy. Additive and repeat-safe.

BEGIN;

ALTER TABLE public.site_media ADD COLUMN IF NOT EXISTS source_photo_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS site_media_source_photo ON public.site_media (source_photo_id) WHERE source_photo_id IS NOT NULL;

ALTER TABLE public.site_media_links DROP CONSTRAINT IF EXISTS site_media_links_target_type_check;
ALTER TABLE public.site_media_links ADD CONSTRAINT site_media_links_target_type_check
  CHECK (target_type IN ('site_category', 'color', 'shape', 'size', 'grade'));

COMMIT;
