-- Payment status "N/A" (not set yet) becomes the default for new orders.
-- Buyers see nothing about payment while an order is 'na'; admin switches it
-- to pending / partial / paid.
--
-- Narrow and repeat-safe: only the check constraint and the column default
-- change. Existing orders keep whatever payment_status they have today.
BEGIN;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status = ANY (ARRAY['na'::text, 'pending'::text, 'partial'::text, 'paid'::text]));

ALTER TABLE public.orders ALTER COLUMN payment_status SET DEFAULT 'na';

COMMIT;
