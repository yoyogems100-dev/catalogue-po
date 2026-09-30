-- Moissanite: add the 93 sizes from the owner's supplier sheet (moissanite.xlsx)
-- that were not yet linked, and give Tapered Baguette the same sizes as
-- Trapezoid (they are the same cut; Tapered Baguette was linked with no sizes).
-- Additive only: existing links, prices, master sizes and orders are untouched.
-- diamond_equivalent_ct is the sheet's "size reference weight" column; left
-- NULL where the sheet has none (or, for Trillion 2x2/2.5x2.5, where the sheet
-- has the size typed in the weight column by mistake).
BEGIN;
CREATE TEMP TABLE moissanite_excel_import(shape_name text,size_mm text,dew numeric) ON COMMIT DROP;
INSERT INTO moissanite_excel_import VALUES
('Round','1.25',NULL),
('Round','1.75',NULL),
('Round','2.25',NULL),
('Round','2.75',NULL),
('Round','3.1',0.12),
('Round','3.2',0.14),
('Round','3.3',0.16),
('Round','3.4',0.18),
('Round','3.7',0.24),
('Round','3.8',0.26),
('Round','3.9',0.28),
('Round','6.75',1.1),
('Heart','2x2',NULL),
('Heart','2.5x2.5',NULL),
('Asscher','2x2',NULL),
('Asscher','2.5x2.5',NULL),
('Asscher','3x3',0.15),
('Emerald Cut','1.5x2.5',NULL),
('Emerald Cut','1.5x3',NULL),
('Emerald Cut','2x3',NULL),
('Emerald Cut','2.5x3.5',NULL),
('Emerald Cut','2.5x5',NULL),
('Emerald Cut','7x10',3.5),
('Cushion','3x3',0.15),
('Baguette','1x1.25',NULL),
('Baguette','1x1.3',NULL),
('Baguette','1x1.4',NULL),
('Baguette','1x1.75',NULL),
('Baguette','1x2.5',NULL),
('Baguette','1x2.75',NULL),
('Baguette','1.25x1.75',NULL),
('Baguette','1.25x2',NULL),
('Baguette','1.25x2.25',NULL),
('Baguette','1.25x2.5',NULL),
('Baguette','1.5x1.75',NULL),
('Baguette','1.5x2.25',NULL),
('Baguette','1.5x3.5',NULL),
('Baguette','1.5x4',NULL),
('Baguette','2x2.5',NULL),
('Baguette','2x2.75',NULL),
('Baguette','2x3.5',NULL),
('Baguette','2x4.5',NULL),
('Baguette','2.5x3',NULL),
('Baguette','2.5x4',NULL),
('Baguette','3x4',0.45),
('Baguette','4x6',0.8),
('Oval','1.5x2.5',NULL),
('Oval','1.5x3',NULL),
('Oval','2x3',NULL),
('Oval','2.5x3.5',NULL),
('Oval','3x4',0.26),
('Oval','4x5',0.5),
('Oval','7x11',2.8),
('Oval','12x16',13),
('Radiant','1.5x2.5',NULL),
('Radiant','1.5x3',NULL),
('Trillion','2x2',NULL),
('Trillion','2.5x2.5',NULL),
('Trillion','3x3',0.1),
('Trillion','3.5x3.5',0.2),
('Triangle','2x2',NULL),
('Triangle','2.5x2.5',NULL),
('Triangle','3x3',0.1),
('Triangle','3.5x3.5',0.2),
('Pear','1.5x2.5',NULL),
('Pear','2x3.5',NULL),
('Pear','4x5',0.4),
('Pear','7x9',1.8),
('Pear','8x11',3.5),
('Pear','9x11',4.5),
('Marquise','2x3',NULL),
('Marquise','2x3.5',NULL),
('Marquise','2.5x4',NULL),
('Marquise','3x5',0.25),
('Marquise','3.5x7',0.4),
('Princess','1.4x1.4',NULL),
('Princess','1.6x1.6',NULL),
('Princess','1.7x1.7',NULL),
('Princess','1.8x1.8',NULL),
('Princess','1.9x1.9',NULL),
('Princess','2.25x2.25',NULL),
('Trapezoid','1.5x1.25x1',NULL),
('Trapezoid','2x1.25x1',NULL),
('Trapezoid','1.75x1.5x1',NULL),
('Trapezoid','3.5x1.5x1',NULL),
('Trapezoid','2.5x2x1',NULL),
('Trapezoid','2.5x2x1.5',NULL),
('Trapezoid','3x2x1.5',NULL),
('Trapezoid','3.5x2x1.5',NULL),
('Trapezoid','4x2x1.5',NULL),
('Trapezoid','3x2.5x1.5',NULL),
('Trapezoid','6x3x2',NULL),
('Trapezoid','5x3x2.5',NULL);
-- Resolve names through the shapes already linked to Moissanite: the master
-- table has more than one shape with some names (e.g. two "Heart" rows).
CREATE TEMP TABLE moissanite_shape_map ON COMMIT DROP AS
SELECT s.name,s.id FROM shapes s JOIN category_shapes cs ON cs.shape_id=s.id AND cs.category_id=34;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM categories WHERE id=34 AND slug='moissanite') THEN RAISE EXCEPTION 'Moissanite category mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM (SELECT DISTINCT shape_name FROM moissanite_excel_import UNION SELECT 'Tapered Baguette') i
   WHERE (SELECT count(*) FROM moissanite_shape_map m WHERE m.name=i.shape_name)<>1) THEN RAISE EXCEPTION 'Shape not linked to Moissanite exactly once'; END IF;
END $$;
INSERT INTO shape_sizes(shape_id,size_mm)
SELECT DISTINCT m.id,i.size_mm FROM moissanite_excel_import i JOIN moissanite_shape_map m ON m.name=i.shape_name
WHERE NOT EXISTS(SELECT 1 FROM shape_sizes z WHERE z.shape_id=m.id AND z.size_mm=i.size_mm);
INSERT INTO category_shape_sizes(category_id,shape_size_id,diamond_equivalent_ct)
SELECT 34,(SELECT min(z.id) FROM shape_sizes z WHERE z.shape_id=m.id AND z.size_mm=i.size_mm),i.dew
FROM moissanite_excel_import i JOIN moissanite_shape_map m ON m.name=i.shape_name
ON CONFLICT DO NOTHING;
-- Tapered Baguette mirrors every Trapezoid size linked to Moissanite.
CREATE TEMP TABLE moissanite_trapezoid_sizes ON COMMIT DROP AS
SELECT z.size_mm,css.diamond_equivalent_ct AS dew
FROM category_shape_sizes css JOIN shape_sizes z ON z.id=css.shape_size_id JOIN moissanite_shape_map m ON m.id=z.shape_id
WHERE css.category_id=34 AND m.name='Trapezoid';
INSERT INTO shape_sizes(shape_id,size_mm)
SELECT DISTINCT tb.id,t.size_mm FROM moissanite_trapezoid_sizes t CROSS JOIN (SELECT id FROM moissanite_shape_map WHERE name='Tapered Baguette') tb
WHERE NOT EXISTS(SELECT 1 FROM shape_sizes z WHERE z.shape_id=tb.id AND z.size_mm=t.size_mm);
INSERT INTO category_shape_sizes(category_id,shape_size_id,diamond_equivalent_ct)
SELECT 34,(SELECT min(z.id) FROM shape_sizes z WHERE z.shape_id=tb.id AND z.size_mm=t.size_mm),t.dew
FROM moissanite_trapezoid_sizes t CROSS JOIN (SELECT id FROM moissanite_shape_map WHERE name='Tapered Baguette') tb
ON CONFLICT DO NOTHING;
-- Same real photo as Trapezoid (bundled for the size-chart PDF), only if none is set.
UPDATE category_shapes cs SET ref_photo_url='/moissanite-shapes/trapezoid.png',reference_style='photo'
FROM moissanite_shape_map m WHERE m.id=cs.shape_id AND m.name='Tapered Baguette' AND cs.category_id=34 AND cs.ref_photo_url IS NULL;
COMMIT;
