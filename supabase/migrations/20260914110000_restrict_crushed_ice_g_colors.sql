-- Keep the current Crushed Ice Cut offering limited to the approved G-series colors.
DO $$
DECLARE
  crushed_ice_category_id integer;
  selected_codes text[] := ARRAY[
    'G05', 'G08', 'G14', 'G15', 'G18', 'G27', 'G28', 'G31',
    'G32', 'G35', 'G38', 'G39', 'G40', 'G41', 'G42', 'G45',
    'G53', 'G54', 'G55', 'G56', 'G57', 'G60', 'G61', 'G66'
  ];
  matched_color_count integer;
BEGIN
  SELECT id
  INTO crushed_ice_category_id
  FROM public.categories
  WHERE name = 'Crushed Ice Cut'
  LIMIT 1;

  IF crushed_ice_category_id IS NULL THEN
    RAISE EXCEPTION 'Crushed Ice Cut category was not found';
  END IF;

  SELECT count(*)
  INTO matched_color_count
  FROM public.colors
  WHERE upper(regexp_replace(split_part(name, ' ', 1), '[^A-Za-z0-9]', '', 'g')) = ANY(selected_codes);

  IF matched_color_count <> array_length(selected_codes, 1) THEN
    RAISE EXCEPTION 'Expected % approved G colors, but found %', array_length(selected_codes, 1), matched_color_count;
  END IF;

  INSERT INTO public.category_colors (category_id, color_id)
  SELECT crushed_ice_category_id, id
  FROM public.colors
  WHERE upper(regexp_replace(split_part(name, ' ', 1), '[^A-Za-z0-9]', '', 'g')) = ANY(selected_codes)
  ON CONFLICT (category_id, color_id) DO NOTHING;

  DELETE FROM public.category_colors AS category_color
  WHERE category_color.category_id = crushed_ice_category_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.colors AS color
      WHERE color.id = category_color.color_id
        AND upper(regexp_replace(split_part(color.name, ' ', 1), '[^A-Za-z0-9]', '', 'g')) = ANY(selected_codes)
    );
END
$$;
