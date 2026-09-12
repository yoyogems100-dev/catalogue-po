-- Pending data migration: apply together with the pearl thumbnail asset release.
-- Changes only Glass Pearls links; never deletes master colors or order/photo references.
BEGIN;
DO $$
DECLARE pearl_category integer;
BEGIN
  SELECT id INTO STRICT pearl_category FROM public.categories WHERE slug = 'glass-pearls';
END $$;
CREATE TEMP TABLE pearl_chart (name text, image text, position integer) ON COMMIT DROP;
INSERT INTO pearl_chart VALUES
    ('White 650', '/pearl-colors/650.png', 0),
    ('Creamrose Light 618', '/pearl-colors/618.png', 1),
    ('Cream 620', '/pearl-colors/620.png', 2),
    ('Creamrose 621', '/pearl-colors/621.png', 3),
    ('Light Gold 539', '/pearl-colors/539.png', 4),
    ('Gold 296', '/pearl-colors/296.png', 5),
    ('Vintage Gold 651', '/pearl-colors/651.png', 6),
    ('Bright Gold 306', '/pearl-colors/306.png', 7),
    ('Peach 300', '/pearl-colors/300.png', 8),
    ('Rose Peach 674', '/pearl-colors/674.png', 9),
    ('Powder Almond 305', '/pearl-colors/305.png', 10),
    ('Rose Gold 769', '/pearl-colors/769.png', 11),
    ('Bronze 295', '/pearl-colors/295.png', 12),
    ('Rosaline 294', '/pearl-colors/294.png', 13),
    ('Powder Rose 352', '/pearl-colors/352.png', 14),
    ('Burgundy 301', '/pearl-colors/301.png', 15),
    ('Mauve 160', '/pearl-colors/160.png', 16),
    ('Lavender 524', '/pearl-colors/524.png', 17),
    ('Light Blue 302', '/pearl-colors/302.png', 18),
    ('Light Grey 616', '/pearl-colors/616.png', 19),
    ('Platinum 459', '/pearl-colors/459.png', 20),
    ('Grey 731', '/pearl-colors/731.png', 21),
    ('Dark Grey 617', '/pearl-colors/617.png', 22),
    ('Black 298', '/pearl-colors/298.png', 23);
INSERT INTO public.colors (name, ref_photo_url, sort_order)
SELECT name, image, (SELECT COALESCE(MAX(sort_order),0) FROM public.colors) + position + 1
FROM pearl_chart ORDER BY position
ON CONFLICT (name) DO UPDATE SET ref_photo_url = EXCLUDED.ref_photo_url;
DELETE FROM public.category_colors
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'glass-pearls')
  AND color_id NOT IN (SELECT colors.id FROM public.colors JOIN pearl_chart ON colors.name = pearl_chart.name);
INSERT INTO public.category_colors (category_id, color_id)
SELECT categories.id, colors.id FROM public.categories CROSS JOIN public.colors JOIN pearl_chart ON colors.name = pearl_chart.name
WHERE categories.slug = 'glass-pearls'
ON CONFLICT DO NOTHING;
COMMIT;
