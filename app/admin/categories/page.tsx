import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import CategoriesClient from './CategoriesClient';

// Admin pages never call a dynamic API (cookies()/headers()) themselves --
// auth happens purely in middleware -- so without this, Next can statically
// cache a page at build time and never pick up new data until the next
// deploy. Every admin list page needs this for the same reason.
export const dynamic = 'force-dynamic';

async function countByPaging() {
  const [{ data: categories }, ...links] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, slug, thumbnail_photo_id, archived_at').order('num'),
    ...(['category_shapes', 'category_colors', 'category_shape_sizes'] as const).map((table) =>
      fetchAllRows<{ category_id: number }>((from, to) => supabaseAdmin.from(table).select('category_id', { count: 'exact' }).range(from, to)))
  ]);
  const [shapes, colors, sizes] = links.map(({ data }) => {
    const counts: Record<number, number> = {};
    (data || []).forEach((r) => { counts[r.category_id] = (counts[r.category_id] || 0) + 1; });
    return counts;
  });
  return (categories || []).map((c) => ({
    ...c,
    category_shapes: [{ count: shapes[c.id] || 0 }],
    category_colors: [{ count: colors[c.id] || 0 }],
    category_shape_sizes: [{ count: sizes[c.id] || 0 }]
  }));
}

export default async function CategoriesListPage() {
  // Link counts come back with the categories as embedded counts -- one
  // request that Postgres counts, instead of downloading every row of three
  // join tables (4000+ size links) just to count them here. Photos are still
  // read (narrow columns, paged past the 1000-row cap) because the cards need
  // each category's first photo for its cover.
  type CategoryRow = {
    id: number; num: number; name: string; slug: string | null; thumbnail_photo_id: number | null; archived_at: string | null;
    category_shapes: { count: number }[]; category_colors: { count: number }[]; category_shape_sizes: { count: number }[];
  };
  const [{ data: countedRaw, error: countedError }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, slug, thumbnail_photo_id, archived_at, category_shapes(count), category_colors(count), category_shape_sizes(count)').order('num'),
    fetchAllRows<any>((from, to) => supabaseAdmin.from('photos').select('id, category_id, is_cover_only, storage_path, drive_id, photo_crop, cover_crop', { count: 'exact' }).order('sort_order', { ascending: true }).order('id', { ascending: true }).range(from, to))
  ]);
  // Should the embedded counts ever be refused, count the old way (every
  // link row, paged) rather than show a broken page.
  const categoriesRaw = countedError ? await countByPaging() : countedRaw;
  const categories = (categoriesRaw || []) as unknown as CategoryRow[];
  const countOf = (rows: { count: number }[] | null | undefined) => rows?.[0]?.count ?? 0;

  function countBy(rows: { category_id: number }[] | null) {
    const counts: Record<number, number> = {};
    (rows || []).forEach((r) => { counts[r.category_id] = (counts[r.category_id] || 0) + 1; });
    return counts;
  }

  // A dedicated cover-only upload isn't a catalogue stone -- it doesn't
  // count toward "N photos" and never stands in as the fallback cover for
  // a category that hasn't explicitly set one (thumbnail_photo_id lookup
  // below still finds it fine either way).
  const galleryPhotos = (photos || []).filter((p: any) => !p.is_cover_only);
  const photoCounts = countBy(galleryPhotos);

  const firstPhotoByCategory: Record<number, any> = {};
  galleryPhotos.forEach((p: any) => {
    if (!firstPhotoByCategory[p.category_id]) firstPhotoByCategory[p.category_id] = p;
  });
  const photoById: Record<number, any> = {};
  (photos || []).forEach((p: any) => { photoById[p.id] = p; });

  function coverUrl(c: { id: number; thumbnail_photo_id: number | null }) {
    const cover = (c.thumbnail_photo_id && photoById[c.thumbnail_photo_id]) || firstPhotoByCategory[c.id] || null;
    // Cards got wider in the recent decluttering pass -- 80px was fine for
    // the old cramped 170px cards but stretched badly blurry once cards grew
    // past 250px. 500 matches what the main site requests for its own
    // similarly-sized category tiles.
    return cover ? photoUrl(cover, 500, 'cover') : null;
  }

  const rows = categories.map((c) => ({
    id: c.id,
    num: c.num,
    name: c.name,
    archivedAt: c.archived_at,
    coverUrl: coverUrl(c),
    photoCount: photoCounts[c.id] || 0,
    shapeCount: countOf(c.category_shapes),
    sizeCount: countOf(c.category_shape_sizes),
    colorCount: countOf(c.category_colors)
  }));

  return (
    <>
      <h1>Categories</h1>
      <CategoriesClient rows={rows} />
    </>
  );
}
