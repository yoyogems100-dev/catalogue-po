# Database Migration History

`supabase/schema.sql` and `supabase/seed_photos.sql` are the original bootstrap.
The following migrations were applied afterward directly against the live
Supabase project (kqjdtjygrvpwcnexqtbz) and are NOT reflected in schema.sql —
this file is the record of what's actually live.

1. **add_category_thumbnail** — `categories.thumbnail_photo_id` (FK to photos),
   lets a category have an explicit cover photo instead of always using the
   first photo.

2. **add_category_shape_sizes** — new join table `category_shape_sizes
   (category_id, shape_size_id)`. Lets each category expose a specific subset
   of a shape's sizes (e.g. Cushion 3x4 available in one category, not another).

3. **add_branding_settings_and_icons**
   - New `settings` table (key/value) — seeded with `whatsapp_number`.
   - `colors.hex_value` — real swatch color per color name.
   - `shapes.icon_key` / `tags.icon_key` — maps to vector icons in
     `components/ShapeIcon.tsx`.
   - `categories.description` — optional, not yet surfaced in any UI.

4. **seed_color_hex_values** — populated hex_value for all 19 master colors.

5. **seed_shape_icon_keys** — populated icon_key for all 34 master shapes
   (round, cushion, pear/oval, marquise, heart, baguette, hexagon, octagon,
   and 16 others — see ShapeIcon.tsx for the full key list).

6. **add_contact_settings** — added `contact_name` ("Gaurav Jain"),
   `location` ("Jaipur | China"), `instagram_handle`, `instagram_url` to
   the settings table.

## Current full table list
categories, shapes, colors, tags, shape_sizes, photos, photo_tags,
category_shapes, category_colors, category_tags, category_shape_sizes,
settings

## RLS pattern
Every table: public read policy (`for select using (true)`), writes only via
the service-role key (used exclusively in `app/admin/**` and `app/api/**`,
never in public-facing code).
