BEGIN;

ALTER TABLE public.category_shapes
  ADD COLUMN IF NOT EXISTS reference_style text NOT NULL DEFAULT 'vector';

ALTER TABLE public.category_shapes
  DROP CONSTRAINT IF EXISTS category_shapes_reference_style_check;

ALTER TABLE public.category_shapes
  ADD CONSTRAINT category_shapes_reference_style_check
  CHECK (reference_style IN ('vector', 'photo'));

-- Existing Moissanite reference photos were deliberately supplied for the
-- public selector and PDF. Other categories keep the safer vector default.
UPDATE public.category_shapes
SET reference_style = 'photo'
WHERE category_id = 34 AND ref_photo_url IS NOT NULL;

COMMIT;
