-- Archive (deactivate) a category without deleting anything.
--
-- archived_at is null for every live category. When it is set, the category
-- disappears from the public website and /po catalogue, but its photos,
-- shape/colour/size links, pricing and past orders are all kept, and the
-- admin can restore it at any time from the Categories page.
--
-- Hiding is enforced here, in the public read policy, so every anon-key read
-- (catalogue pages, app API, size-chart PDFs, what's-new, marketing site)
-- skips archived categories without each query having to remember to. Server
-- routes using the service-role key bypass RLS and still see them.
--
-- Additive and repeat-safe.

begin;

alter table public.categories add column if not exists archived_at timestamptz;

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
  for select using (archived_at is null);

commit;
