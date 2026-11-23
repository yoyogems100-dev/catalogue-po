-- Owner decision 2026-11-23: the 30 orders that were 'pending' only because
-- that was the old default go back to N/A ("not set").
--
-- Explicit IDs (read from production 2026-11-23), and only while still
-- 'pending', so newer orders and anything admin has since set are untouched.
-- Run after 20261123090000_payment_status_na.sql and after the code that
-- understands 'na' is live. Repeat-safe.
BEGIN;

UPDATE public.orders
SET payment_status = 'na', updated_at = now()
WHERE payment_status = 'pending'
  AND id IN (1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31);

COMMIT;
