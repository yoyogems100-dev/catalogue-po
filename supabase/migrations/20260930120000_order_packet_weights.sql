-- Packet weights for an order, entered by the team in admin once the goods
-- are packed: one weight per packet, a packet being every line of one shape
-- (or one shape and size), e.g. 12 materials of Oval 6x8 mm in one packet.
-- Stored as JSON on the order: { mode: 'shape' | 'shape_size', packets:
-- [{ categoryId, shapeId, sizeId, weight, unit: 'g' | 'ct' }] }.
-- Nullable: no existing order changes.
alter table public.orders add column if not exists packet_weights jsonb;
