-- Recycle Bin: the dustbin icon on an orders/customers/suppliers row hides it
-- from the normal list (soft delete) instead of destroying it immediately.
-- Permanent deletion only happens from the dedicated Bin admin page.
alter table orders add column if not exists deleted_at timestamptz;
alter table customers add column if not exists deleted_at timestamptz;
alter table suppliers add column if not exists deleted_at timestamptz;

create index if not exists orders_deleted_at_idx on orders (deleted_at) where deleted_at is not null;
create index if not exists customers_deleted_at_idx on customers (deleted_at) where deleted_at is not null;
create index if not exists suppliers_deleted_at_idx on suppliers (deleted_at) where deleted_at is not null;
