-- color_palettes / color_palette_items have had RLS enabled with zero policies
-- since they were introduced, so the anon/public client has never been able to
-- read them -- the palette quick-select feature (MultiSelect's `palettes` prop)
-- has been silently non-functional everywhere, including the existing
-- "F - Gem Ice Flower" palette. Match the existing public-read pattern used by
-- every other catalogue table (e.g. colors, shapes).
drop policy if exists "public read color_palettes" on color_palettes;
drop policy if exists "public read color_palette_items" on color_palette_items;
create policy "public read color_palettes" on color_palettes for select to public using (true);
create policy "public read color_palette_items" on color_palette_items for select to public using (true);
