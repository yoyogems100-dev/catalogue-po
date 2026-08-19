import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import CategoriesClient from './CategoriesClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function CategoriesListPage() {
  const [{ data: categories }, { data: photos }, { data: catShapes }, { data: catColors }, { data: catSizes }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, slug, thumbnail_photo_id, badge_type').order('num'),
    supabaseAdmin.from('photos').select('id, category_id, storage_path, drive_id, sort_order').order('sort_order', { ascending: true }).order('id', { ascending: true }),
    supabaseAdmin.from('category_shapes').select('category_id'),
    supabaseAdmin.from('category_colors').select('category_id'),
    supabaseAdmin.from('category_shape_sizes').select('category_id')
  ]);

  function countBy(rows: { category_id: number }[] | null) {
    const counts: Record<number, number> = {};
    (rows || []).forEach((r) => { counts[r.category_id] = (counts[r.category_id] || 0) + 1; });
    return counts;
  }

  const photoCounts = countBy(photos);
  const shapeCounts = countBy(catShapes);
  const colorCounts = countBy(catColors);
  const sizeCounts = countBy(catSizes);

  const firstPhotoByCategory: Record<number, any> = {};
  (photos || []).forEach((p: any) => {
    if (!firstPhotoByCategory[p.category_id]) firstPhotoByCategory[p.category_id] = p;
  });
  const photoById: Record<number, any> = {};
  (photos || []).forEach((p: any) => { photoById[p.id] = p; });

  function coverUrl(c: { id: number; thumbnail_photo_id: number | null }) {
    const cover = (c.thumbnail_photo_id && photoById[c.thumbnail_photo_id]) || firstPhotoByCategory[c.id] || null;
    return cover ? photoUrl(cover, 80) : null;
  }

  const rows = (categories || []).map((c) => ({
    id: c.id,
    num: c.num,
    name: c.name,
    coverUrl: coverUrl(c),
    photoCount: photoCounts[c.id] || 0,
    shapeCount: shapeCounts[c.id] || 0,
    sizeCount: sizeCounts[c.id] || 0,
    colorCount: colorCounts[c.id] || 0,
    badgeType: c.badge_type as 'shapes' | 'colors' | 'sizes' | 'none'
  }));

  return (
    <>
      <h1>Categories</h1>
      <CategoriesClient rows={rows} />
    </>
  );
}
