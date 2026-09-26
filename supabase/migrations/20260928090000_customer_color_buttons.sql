-- A buyer's own colour buttons: which colour families they see in Quick Order
-- and on the home page, in order, as a JSON array of family IDs. NULL means
-- "same as the shop" (settings.quick_order_color_buttons).
BEGIN;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS color_buttons jsonb;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_color_buttons_is_array;
ALTER TABLE public.customers ADD CONSTRAINT customers_color_buttons_is_array
  CHECK (color_buttons IS NULL OR jsonb_typeof(color_buttons) = 'array');
COMMIT;
