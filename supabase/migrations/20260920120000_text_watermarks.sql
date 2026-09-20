-- A watermark can be typed rather than uploaded.
--
-- Adding one meant preparing a transparent PNG of your own name somewhere
-- else and uploading it -- to put text on a photo. The text, its colour and
-- its transparency are the whole design, so they belong in the record.
--
-- Uploaded presets keep working untouched: storage_path simply becomes
-- optional, and a row is one or the other.

alter table watermarks
  add column if not exists text text,
  add column if not exists color text;

alter table watermarks alter column storage_path drop not null;

-- Every existing row has a storage_path, so this passes on today's data.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'watermarks_image_or_text') then
    alter table watermarks add constraint watermarks_image_or_text
      check (storage_path is not null or nullif(btrim(text), '') is not null);
  end if;
end $$;
