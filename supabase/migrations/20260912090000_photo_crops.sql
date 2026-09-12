-- Originals stay in storage_path / drive_id; each display use has its own crop.
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS photo_crop jsonb;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS cover_crop jsonb;
COMMENT ON COLUMN public.photos.photo_crop IS 'Admin crop settings and generated storage path for product photos. Null uses original.';
COMMENT ON COLUMN public.photos.cover_crop IS 'Independent category cover crop. Null uses product crop, then original.';
