import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import Link from 'next/link';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function CategoriesListPage() {
  const [{ data: categories }, { data: photos }, { data: catShapes }, { data: catColors }, { data: catSizes }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, slug, thumbnail_photo_id').order('num'),
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

  return (
    <>
      <h1>Categories</h1>
      <table>
        <thead>
          <tr><th>#</th><th>Cover</th><th>Category</th><th>Photos</th><th>Shapes</th><th>Sizes</th><th>Colors</th><th></th></tr>
        </thead>
        <tbody>
          {(categories || []).map((c) => {
            const cover = coverUrl(c);
            return (
              <tr key={c.id}>
                <td>{String(c.num).padStart(2, '0')}</td>
                <td>
                  <div className="admin-cover-thumb">
                    {cover ? <img src={cover} alt="" /> : <span>No photo</span>}
                  </div>
                </td>
                <td>{c.name}</td>
                <td>{photoCounts[c.id] || 0}</td>
                <td>{shapeCounts[c.id] || 0}</td>
                <td>{sizeCounts[c.id] || 0}</td>
                <td>{colorCounts[c.id] || 0}</td>
                <td><Link href={`/admin/categories/${c.id}`} className="btn-ghost" style={{ display: 'inline-block' }}>Manage &rarr;</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
