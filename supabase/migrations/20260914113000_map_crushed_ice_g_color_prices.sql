-- Reuse the closest existing Crushed Ice pricing group for each approved G color.
WITH mappings(color_code, group_name) AS (
  VALUES
    ('G40', 'White Zircon'),
    ('G08', 'Regular Colors'),
    ('G14', 'Regular Colors'),
    ('G42', 'Regular Colors'),
    ('G45', 'Regular Colors'),
    ('G15', 'Light Colors'),
    ('G41', 'Light Colors'),
    ('G53', 'Light Colors'),
    ('G66', 'Light Colors'),
    ('G05', 'Medium Colors'),
    ('G54', 'Medium Colors'),
    ('G55', 'Medium Colors'),
    ('G56', 'Medium Colors'),
    ('G57', 'Medium Colors'),
    ('G18', 'Premium Colors'),
    ('G31', 'Premium Colors'),
    ('G32', 'Premium Colors'),
    ('G38', 'Premium Colors'),
    ('G39', 'Premium Colors'),
    ('G60', 'Premium Colors'),
    ('G61', 'Premium Colors'),
    ('G35', 'Royal Blue'),
    ('G27', 'Paraiba'),
    ('G28', 'Paraiba')
), selected_colors AS (
  SELECT color.id AS color_id, mapping.group_name
  FROM mappings AS mapping
  JOIN public.colors AS color
    ON upper(regexp_replace(split_part(color.name, ' ', 1), '[^A-Za-z0-9]', '', 'g')) = mapping.color_code
), removed_old_memberships AS (
  DELETE FROM public.color_price_group_members AS member
  USING selected_colors AS selected
  WHERE member.color_id = selected.color_id
)
INSERT INTO public.color_price_group_members (group_id, color_id)
SELECT price_group.id, selected.color_id
FROM selected_colors AS selected
JOIN public.color_price_groups AS price_group ON price_group.name = selected.group_name
ON CONFLICT (group_id, color_id) DO NOTHING;
