BEGIN;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color_chart_url text;
COMMENT ON COLUMN public.categories.color_chart_url IS 'Optional category reference chart, managed independently from product and cover photos.';
UPDATE public.categories SET color_chart_url='/color-charts/crushed-ice-reference.jpg'
WHERE slug='crushed-ice-cut' AND color_chart_url IS NULL;
COMMIT;
