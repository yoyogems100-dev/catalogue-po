-- A photo group is a lead photo plus its extra angles.
--
-- The lead carries the shape/size/colour/spec tags, exactly as every photo
-- already does; an angle just points at its lead and inherits them. Modelling
-- it this way means no new tables and no change to any existing tagging,
-- filtering or PDF query -- an ungrouped photo is simply a group of one, and
-- everything that reads `photos` today keeps working untouched.
alter table photos add column if not exists parent_photo_id integer;

-- ON DELETE SET NULL, so deleting a lead promotes its angles to standalone
-- photos rather than destroying them with it.
do $$ begin
  alter table photos add constraint photos_parent_photo_id_fkey
    foreign key (parent_photo_id) references photos(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Groups are one level deep: an angle is never itself a lead. The app enforces
-- that; the database guarantees only that a photo cannot be its own parent,
-- which is the case no application logic could recover from.
alter table photos drop constraint if exists photos_parent_not_self;
alter table photos add constraint photos_parent_not_self
  check (parent_photo_id is null or parent_photo_id <> id);

create index if not exists photos_parent_photo_id_idx on photos (parent_photo_id);
