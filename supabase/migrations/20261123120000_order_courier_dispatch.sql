-- Per-order courier and "dispatched straight from Jaipur" flag (admin-only).
-- Additive and repeat-safe: existing orders keep the China route, no courier.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dispatch_from_jaipur boolean NOT NULL DEFAULT false;
COMMIT;
