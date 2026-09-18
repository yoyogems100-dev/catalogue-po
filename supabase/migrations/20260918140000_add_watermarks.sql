-- Admin-managed watermark presets (2-3 typical: wm1/wm2/wm3), each with its
-- own opacity. Applying one to a photo never touches the original file --
-- same "derivative, not overwrite" approach as photo_crop/cover_crop -- the
-- composited result is stored separately and can be removed to revert.
begin;
create table if not exists watermarks (
  id serial primary key,
  name text not null,
  storage_path text not null,
  opacity numeric not null default 0.5 check (opacity > 0 and opacity <= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
-- Admin-only table -- no public page ever reads watermark presets directly,
-- unlike hot_selling_options which the public catalogue queries.
alter table watermarks enable row level security;
revoke all on watermarks from anon, authenticated;
grant all on watermarks to service_role;

alter table photos add column if not exists watermark_id integer references watermarks(id) on delete set null;
alter table photos add column if not exists watermarked_path text;
commit;
