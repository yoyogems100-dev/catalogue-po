-- Every photo the site and /po show now carries the YOYO GEMS watermark.
--
-- The watermarked copy is what storage_path (and the saved crops / website
-- widths) point at, in the public `photos` bucket. The file as uploaded is
-- kept untouched in a PRIVATE `originals` bucket, recorded here, so crops and
-- re-renders always start from the clean picture and a photo is never marked
-- twice. Drive-imported photos keep Drive as their original (drive_id) and
-- need no path.
--
-- Additive and repeat-safe. The bucket gets no storage policies: only the
-- service role (server routes, scripts) can read or write it.

alter table photos add column if not exists original_path text;
alter table site_media add column if not exists original_path text;

insert into storage.buckets (id, name, public)
values ('originals', 'originals', false)
on conflict (id) do nothing;
