import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';

export default async function CategoriesListPage() {
  const [{ data: categories }, { data: photos }, { data: catShapes }, { data: catColors }, { data: catSizes }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, slug').order('num'),
    supabaseAdmin.from('photos').select('category_id'),
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

  return (
    <>
      <h1>Categories</h1>
      <table>
        <thead>
          <tr><th>#</th><th>Category</th><th>Photos</th><th>Shapes</th><th>Sizes</th><th>Colors</th><th></th></tr>
        </thead>
        <tbody>
          {(categories || []).map((c) => (
            <tr key={c.id}>
              <td>{String(c.num).padStart(2, '0')}</td>
              <td>{c.name}</td>
              <td>{photoCounts[c.id] || 0}</td>
              <td>{shapeCounts[c.id] || 0}</td>
              <td>{sizeCounts[c.id] || 0}</td>
              <td>{colorCounts[c.id] || 0}</td>
              <td><Link href={`/admin/categories/${c.id}`} className="btn-ghost" style={{ display: 'inline-block' }}>Manage &rarr;</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
