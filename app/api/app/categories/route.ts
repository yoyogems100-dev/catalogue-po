import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { photoUrl } from '@/lib/photos';
import { fetchAllRows } from '@/lib/fetch-all-rows';

// JSON equivalent of the data app/page.tsx fetches server-side for the web homepage --
// the mobile app needs it as an API response instead of rendered HTML.
export async function GET() {
  // Unfiltered reads of the whole join table -- each must page past the
  // project's 1000-row response cap or silently undercount whichever
  // categories' rows land past the first page. See app/page.tsx for the same fix.
  const [{ data: categories }, { data: photos }, { data: catShapes }, { data: catColors }, { data: catSizes }] = await Promise.all([
    supabasePublic.from('categories').select('id, num, name, slug, thumbnail_photo_id').order('num'),
    fetchAllRows<any>((from, to) => supabasePublic.from('photos').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true }).range(from, to)),
    fetchAllRows<{ category_id: number }>((from, to) => supabasePublic.from('category_shapes').select('category_id').range(from, to)),
    fetchAllRows<{ category_id: number }>((from, to) => supabasePublic.from('category_colors').select('category_id').range(from, to)),
    fetchAllRows<{ category_id: number }>((from, to) => supabasePublic.from('category_shape_sizes').select('category_id').range(from, to))
  ]);

  function countBy(rows: { category_id: number }[] | null) {
    const counts: Record<number, number> = {};
    (rows || []).forEach((r) => { counts[r.category_id] = (counts[r.category_id] || 0) + 1; });
    return counts;
  }

  const shapeCounts = countBy(catShapes);
  const colorCounts = countBy(catColors);
  const sizeCounts = countBy(catSizes);

  const firstPhotoByCategory: Record<number, any> = {};
  (photos || []).forEach((p: any) => {
    if (!p.is_cover_only && !firstPhotoByCategory[p.category_id]) firstPhotoByCategory[p.category_id] = p;
  });
  const photoById: Record<number, any> = {};
  (photos || []).forEach((p: any) => { photoById[p.id] = p; });

  const categoriesFormatted = (categories || []).map((c: any) => {
    const thumbPhoto = (c.thumbnail_photo_id && photoById[c.thumbnail_photo_id]) || firstPhotoByCategory[c.id] || null;
    return {
      id: c.id,
      num: c.num,
      name: c.name,
      slug: c.slug,
      thumb: thumbPhoto ? photoUrl(thumbPhoto, 500, 'cover') : null,
      shapeCount: shapeCounts[c.id] || 0,
      colorCount: colorCounts[c.id] || 0,
      sizeCount: sizeCounts[c.id] || 0
    };
  });

  return NextResponse.json({ categories: categoriesFormatted });
}
