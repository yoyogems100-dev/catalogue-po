-- A new price can be saved without a supplier cost.
--
-- price_rmb is a leftover: 20260916100000_inr_only_pricing.sql converted the
-- app to INR and no code reads or writes the RMB column any more. But it is
-- still NOT NULL with no default, so an INR-only upsert fails outright:
--
--   null value in column "price_rmb" ... violates not-null constraint
--
-- Every row that exists predates that change and was written with an RMB
-- value, so nothing ever hit this until a category with no priced rows at all
-- got somewhere to type a price. The historic costs are worth keeping, so the
-- column stays -- it just no longer has to be invented for a new row.

alter table shape_size_prices alter column price_rmb drop not null;
