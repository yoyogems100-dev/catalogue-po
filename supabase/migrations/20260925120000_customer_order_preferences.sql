-- A buyer's standing defaults, e.g. Red -> Ruby Corundum 5A, White -> 5A Quality CZ.
-- Array of {familyId, categoryId, grade?}; validated in lib/customer-preferences.ts.
-- Additive and repeat-safe: existing customers get an empty list.
alter table customers add column if not exists order_preferences jsonb not null default '[]'::jsonb;
