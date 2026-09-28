-- Semi Precious Beads (category 45): the owner's shapes, sizes and bead
-- materials from the supplier bills (2026-09-29), names exactly as supplied --
-- they are editable in Admin > Categories > Semi Precious Beads > Materials.
-- Repeat-safe: every insert skips rows that already exist. Prices are not set.
BEGIN;
UPDATE public.categories SET option_label = 'Material' WHERE id = 45 AND option_label IS NULL;

INSERT INTO public.shapes (name, icon_key, sort_order, owner_category_id) VALUES
  ('Faceted Five-Pointed Star', 'star', 0, 45),
  ('Faceted Four-Leaf Clover', 'clover', 1, 45),
  ('Four-Leaf Clover', 'clover', 2, 45),
  ('Cabochon Heart', 'heart', 3, 45),
  ('Heart', 'heart', 4, 45),
  ('Oval', 'oval', 5, 45),
  ('Plum Blossom', 'lily', 6, 45)
ON CONFLICT (owner_category_id, name) WHERE owner_category_id IS NOT NULL DO NOTHING;

INSERT INTO public.category_shapes (category_id, shape_id)
SELECT 45, id FROM public.shapes WHERE owner_category_id = 45
ON CONFLICT DO NOTHING;

INSERT INTO public.shape_sizes (shape_id, size_mm)
SELECT s.id, v.size_mm FROM (VALUES
  ('Faceted Five-Pointed Star', '8x8'),
  ('Faceted Four-Leaf Clover', '8x8'),
  ('Four-Leaf Clover', '6x6'),
  ('Four-Leaf Clover', '8x8'),
  ('Cabochon Heart', '6x6'),
  ('Heart', '6x6'),
  ('Oval', '6x8'),
  ('Plum Blossom', '6')
) AS v(shape_name, size_mm)
JOIN public.shapes s ON s.owner_category_id = 45 AND s.name = v.shape_name
WHERE NOT EXISTS (SELECT 1 FROM public.shape_sizes x WHERE x.shape_id = s.id AND x.size_mm = v.size_mm);

INSERT INTO public.category_shape_sizes (category_id, shape_size_id)
SELECT 45, ss.id FROM public.shape_sizes ss JOIN public.shapes s ON s.id = ss.shape_id AND s.owner_category_id = 45
ON CONFLICT DO NOTHING;

INSERT INTO public.colors (name, sort_order, owner_category_id) VALUES
  ('White Crystal', 0, 45),
  ('African Turquoise', 1, 45),
  ('Rose Quartz', 2, 45),
  ('Red Stone', 3, 45),
  ('Crazy Lace Agate', 4, 45),
  ('Green Aventurine', 5, 45),
  ('Blue Lace Agate', 6, 45),
  ('Green Strawberry Quartz', 7, 45),
  ('Amazonite', 8, 45),
  ('Dragon Blood Jasper', 9, 45),
  ('Topaz', 10, 45),
  ('Tiger''s Eye', 11, 45),
  ('Indian Agate', 12, 45),
  ('Grey Labradorite', 13, 45),
  ('Moss Agate', 14, 45),
  ('Amethyst', 15, 45),
  ('Mookaite', 16, 45),
  ('Red Strawberry', 17, 45),
  ('Green Strawberry', 18, 45),
  ('Obsidian', 19, 45),
  ('Picture Jasper', 20, 45),
  ('White Turquoise', 21, 45),
  ('Red Aventurine', 22, 45),
  ('Unakite', 23, 45),
  ('K2 Jasper - blue spots', 24, 45),
  ('Rhodonite', 25, 45),
  ('K2 Jasper - green spots', 26, 45),
  ('Cabochon Heart Spots', 27, 45),
  ('Lemon Jade', 28, 45),
  ('Red Wood Jasper', 29, 45),
  ('African Bloodstone', 30, 45),
  ('Lapis Lazuli', 31, 45),
  ('Ruby in Zoisite', 32, 45),
  ('Spots', 33, 45),
  ('Faceted Green Aventurine', 34, 45),
  ('Oval Amazonite', 35, 45),
  ('Red Leopard Skin', 36, 45),
  ('Dragon''s Blood Stone', 37, 45),
  ('Flash', 38, 45),
  ('Crazy Body', 39, 45),
  ('Plum Blossom / Water Plant Agate', 40, 45),
  ('Green Spots', 41, 45),
  ('Spectrolite', 42, 45),
  ('Blue Spotted Spots', 43, 45)
ON CONFLICT (owner_category_id, name) WHERE owner_category_id IS NOT NULL DO NOTHING;

INSERT INTO public.category_colors (category_id, color_id)
SELECT 45, id FROM public.colors WHERE owner_category_id = 45
ON CONFLICT DO NOTHING;

INSERT INTO public.category_size_colors (category_id, shape_size_id, color_id)
SELECT 45, ss.id, c.id FROM (VALUES
  ('Faceted Five-Pointed Star', '8x8', 'White Crystal'),
  ('Faceted Five-Pointed Star', '8x8', 'African Turquoise'),
  ('Faceted Five-Pointed Star', '8x8', 'Rose Quartz'),
  ('Faceted Five-Pointed Star', '8x8', 'Red Stone'),
  ('Faceted Five-Pointed Star', '8x8', 'Crazy Lace Agate'),
  ('Faceted Five-Pointed Star', '8x8', 'Green Aventurine'),
  ('Faceted Five-Pointed Star', '8x8', 'Blue Lace Agate'),
  ('Faceted Four-Leaf Clover', '8x8', 'Green Strawberry Quartz'),
  ('Faceted Four-Leaf Clover', '8x8', 'Amazonite'),
  ('Faceted Four-Leaf Clover', '8x8', 'Dragon Blood Jasper'),
  ('Faceted Four-Leaf Clover', '8x8', 'Topaz'),
  ('Faceted Four-Leaf Clover', '8x8', 'Tiger''s Eye'),
  ('Faceted Four-Leaf Clover', '8x8', 'Green Aventurine'),
  ('Faceted Four-Leaf Clover', '8x8', 'White Crystal'),
  ('Faceted Four-Leaf Clover', '8x8', 'Indian Agate'),
  ('Faceted Four-Leaf Clover', '8x8', 'Grey Labradorite'),
  ('Four-Leaf Clover', '6x6', 'Moss Agate'),
  ('Four-Leaf Clover', '6x6', 'Amethyst'),
  ('Four-Leaf Clover', '6x6', 'Mookaite'),
  ('Four-Leaf Clover', '6x6', 'Blue Lace Agate'),
  ('Four-Leaf Clover', '6x6', 'Red Strawberry'),
  ('Four-Leaf Clover', '6x6', 'Indian Agate'),
  ('Four-Leaf Clover', '6x6', 'African Turquoise'),
  ('Four-Leaf Clover', '6x6', 'Green Strawberry'),
  ('Four-Leaf Clover', '6x6', 'Obsidian'),
  ('Four-Leaf Clover', '6x6', 'Amazonite'),
  ('Four-Leaf Clover', '6x6', 'Rose Quartz'),
  ('Four-Leaf Clover', '6x6', 'Picture Jasper'),
  ('Four-Leaf Clover', '6x6', 'Topaz'),
  ('Four-Leaf Clover', '8x8', 'Blue Lace Agate'),
  ('Four-Leaf Clover', '8x8', 'Green Strawberry'),
  ('Four-Leaf Clover', '8x8', 'White Turquoise'),
  ('Four-Leaf Clover', '8x8', 'Indian Agate'),
  ('Four-Leaf Clover', '8x8', 'African Turquoise'),
  ('Four-Leaf Clover', '8x8', 'Red Aventurine'),
  ('Four-Leaf Clover', '8x8', 'Crazy Lace Agate'),
  ('Four-Leaf Clover', '8x8', 'Amethyst'),
  ('Four-Leaf Clover', '8x8', 'White Crystal'),
  ('Four-Leaf Clover', '8x8', 'Amazonite'),
  ('Four-Leaf Clover', '8x8', 'Topaz'),
  ('Four-Leaf Clover', '8x8', 'Unakite'),
  ('Four-Leaf Clover', '8x8', 'K2 Jasper - blue spots'),
  ('Four-Leaf Clover', '8x8', 'Rhodonite'),
  ('Four-Leaf Clover', '8x8', 'K2 Jasper - green spots'),
  ('Cabochon Heart', '6x6', 'White Crystal'),
  ('Cabochon Heart', '6x6', 'Cabochon Heart Spots'),
  ('Cabochon Heart', '6x6', 'African Turquoise'),
  ('Cabochon Heart', '6x6', 'Unakite'),
  ('Cabochon Heart', '6x6', 'Green Strawberry'),
  ('Cabochon Heart', '6x6', 'Green Aventurine'),
  ('Cabochon Heart', '6x6', 'Lemon Jade'),
  ('Cabochon Heart', '6x6', 'K2 Jasper - green spots'),
  ('Cabochon Heart', '6x6', 'Grey Labradorite'),
  ('Cabochon Heart', '6x6', 'Picture Jasper'),
  ('Cabochon Heart', '6x6', 'Indian Agate'),
  ('Heart', '6x6', 'Indian Agate'),
  ('Heart', '6x6', 'Mookaite'),
  ('Heart', '6x6', 'Rose Quartz'),
  ('Heart', '6x6', 'Red Stone'),
  ('Heart', '6x6', 'Green Strawberry'),
  ('Heart', '6x6', 'Red Wood Jasper'),
  ('Heart', '6x6', 'Grey Labradorite'),
  ('Heart', '6x6', 'African Bloodstone'),
  ('Heart', '6x6', 'Topaz'),
  ('Heart', '6x6', 'White Crystal'),
  ('Heart', '6x6', 'Unakite'),
  ('Heart', '6x6', 'Lapis Lazuli'),
  ('Heart', '6x6', 'Blue Lace Agate'),
  ('Heart', '6x6', 'Amazonite'),
  ('Heart', '6x6', 'African Turquoise'),
  ('Heart', '6x6', 'Dragon Blood Jasper'),
  ('Heart', '6x6', 'Ruby in Zoisite'),
  ('Heart', '6x6', 'Lemon Jade'),
  ('Heart', '6x6', 'Red Aventurine'),
  ('Heart', '6x6', 'K2 Jasper - blue spots'),
  ('Heart', '6x6', 'Tiger''s Eye'),
  ('Heart', '6x6', 'Picture Jasper'),
  ('Heart', '6x6', 'Spots'),
  ('Heart', '6x6', 'Green Aventurine'),
  ('Oval', '6x8', 'Faceted Green Aventurine'),
  ('Oval', '6x8', 'Oval Amazonite'),
  ('Oval', '6x8', 'Topaz'),
  ('Oval', '6x8', 'Red Leopard Skin'),
  ('Oval', '6x8', 'Green Strawberry'),
  ('Oval', '6x8', 'Dragon''s Blood Stone'),
  ('Oval', '6x8', 'Red Strawberry'),
  ('Oval', '6x8', 'Flash'),
  ('Oval', '6x8', 'Spots'),
  ('Oval', '6x8', 'Red Aventurine'),
  ('Oval', '6x8', 'White Turquoise'),
  ('Oval', '6x8', 'Red Wood Jasper'),
  ('Oval', '6x8', 'African Bloodstone'),
  ('Plum Blossom', '6', 'Crazy Body'),
  ('Plum Blossom', '6', 'Plum Blossom / Water Plant Agate'),
  ('Plum Blossom', '6', 'Red Stone'),
  ('Plum Blossom', '6', 'Green Spots'),
  ('Plum Blossom', '6', 'White Crystal'),
  ('Plum Blossom', '6', 'Unakite'),
  ('Plum Blossom', '6', 'Indian Agate'),
  ('Plum Blossom', '6', 'Tiger''s Eye'),
  ('Plum Blossom', '6', 'Amethyst'),
  ('Plum Blossom', '6', 'Green Aventurine'),
  ('Plum Blossom', '6', 'Spectrolite'),
  ('Plum Blossom', '6', 'Blue Spotted Spots'),
  ('Plum Blossom', '6', 'Mookaite')
) AS v(shape_name, size_mm, material)
JOIN public.shapes s ON s.owner_category_id = 45 AND s.name = v.shape_name
JOIN public.shape_sizes ss ON ss.shape_id = s.id AND ss.size_mm = v.size_mm
JOIN public.colors c ON c.owner_category_id = 45 AND c.name = v.material
ON CONFLICT DO NOTHING;

COMMIT;
