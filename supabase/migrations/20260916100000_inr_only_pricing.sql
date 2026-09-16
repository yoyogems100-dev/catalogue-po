-- Remove RMB as an entry currency: prices are now entered and stored directly
-- in INR everywhere. Existing shape_size_prices rows were entered in RMB with
-- a saved conversion multiplier (settings.rmb_inr_multiplier, last saved as 11);
-- this backfills a new price_inr column with the equivalent INR value so no
-- data is lost or silently re-priced. supplier_rates and order_items already
-- have zero RMB-currency rows at migration time, but the backfill is included
-- for safety in case that changes before this runs.

alter table shape_size_prices add column if not exists price_inr numeric;

update shape_size_prices
set price_inr = price_rmb * 11
where price_inr is null and price_rmb is not null;

update supplier_rates
set cost_price = cost_price * 11, currency = 'INR'
where currency = 'RMB';

update order_items
set cost_price = cost_price * 11, cost_currency = 'INR'
where cost_currency = 'RMB';
