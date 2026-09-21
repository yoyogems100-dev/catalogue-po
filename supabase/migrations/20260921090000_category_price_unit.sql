-- What a price is quoted per. Most categories sell by the piece, but Rainbow
-- Corundum sells by the strip, so the unit belongs to the category rather than
-- being a word hard-coded into the price list.
--
-- NULL means "piece": the existing behaviour, and what every current row means
-- today. Storing free text rather than an enum because the owner needs to be
-- able to name a unit we have not thought of without a migration.
alter table categories add column if not exists price_unit text;

alter table categories drop constraint if exists categories_price_unit_len;
alter table categories add constraint categories_price_unit_len
  check (price_unit is null or char_length(btrim(price_unit)) between 1 and 24);
