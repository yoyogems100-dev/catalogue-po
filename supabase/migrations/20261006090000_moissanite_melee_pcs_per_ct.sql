-- Moissanite melee (Round below 3.00 mm) can be ordered by carat weight.
-- pcs_per_ct is the supplier sheet's "pieces per 1 ct" (moissanite.xlsx, 厘石
-- table, owner-confirmed incl. 2.7 and 2.75 mm both 13). 3.00 mm and up stay
-- pieces only (NULL). Additive: one nullable column, set only on Moissanite.
BEGIN;
ALTER TABLE public.category_shape_sizes ADD COLUMN IF NOT EXISTS pcs_per_ct integer CHECK (pcs_per_ct IS NULL OR pcs_per_ct > 0);
CREATE TEMP TABLE moissanite_melee(size_mm numeric,pcs integer) ON COMMIT DROP;
INSERT INTO moissanite_melee VALUES
(0.7,580),(0.8,410),(0.9,290),(1.0,210),(1.1,160),(1.2,125),(1.25,114),(1.3,100),(1.4,78),(1.5,64),
(1.6,58),(1.7,47),(1.75,43),(1.8,40),(1.9,34),(2.0,28),(2.1,26),(2.2,22),(2.25,21),(2.3,19),
(2.4,18),(2.5,16),(2.6,14),(2.7,13),(2.75,13),(2.8,12),(2.9,10);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM categories WHERE id=34 AND slug='moissanite') THEN RAISE EXCEPTION 'Moissanite category mismatch'; END IF;
END $$;
-- Repeat-safe: the list below is the whole truth for Moissanite.
UPDATE category_shape_sizes SET pcs_per_ct=NULL WHERE category_id=34 AND pcs_per_ct IS NOT NULL;
UPDATE category_shape_sizes css SET pcs_per_ct=m.pcs
FROM shape_sizes z
JOIN category_shapes cs ON cs.shape_id=z.shape_id AND cs.category_id=34
JOIN shapes s ON s.id=z.shape_id AND s.name='Round'
JOIN moissanite_melee m ON z.size_mm ~ '^[0-9]+(\.[0-9]+)?$' AND z.size_mm::numeric=m.size_mm
WHERE css.category_id=34 AND css.shape_size_id=z.id;
DO $$ BEGIN
 IF (SELECT count(*) FROM category_shape_sizes WHERE category_id=34 AND pcs_per_ct IS NOT NULL)<>27 THEN RAISE EXCEPTION 'Expected 27 melee sizes'; END IF;
END $$;
COMMIT;
