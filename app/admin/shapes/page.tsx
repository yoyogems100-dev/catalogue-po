import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import ShapesClient from './ShapesClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function ShapesPage({ searchParams }: { searchParams: Promise<{category?: string}> }) {
  const query = await searchParams;
  const categoryFilter = Number(query.category) || 0;
  // shape_sizes is well past the project's 1000-row response cap; an unpaged
  // select here silently hides whichever sizes land past the first page --
  // e.g. every size added after the table crossed 1000 rows would simply
  // not appear on this page. category_shapes is small (a few hundred rows)
  // and always needed in full, to show which categories each shape belongs
  // to regardless of the filter. category_shape_sizes, on the other hand,
  // is 4000+ rows -- but it's only ever consulted when a category filter is
  // active, so fetch just that one category's rows instead of paging
  // through the whole table on every visit to this page.
  const [{ data: shapes }, { data: sizes }, { data: categories }, { data: catShapes }, {data: catSizes }] = await Promise.all([
    supabaseAdmin.from('shapes').select('id, name, sort_order, icon_key, ref_photo_url').order('sort_order').order('name'),
    fetchAllRows<{ id: number; shape_id: number; size_mm: string; weight_ct: number | null }>((from, to) =>
      supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm, weight_ct', { count: 'exact' }).order('id').range(from, to)
    ),
    supabaseAdmin.from('categories').select('id, num, name').order('num'),
    supabaseAdmin.from('category_shapes').select('category_id, shape_id'),
    categoryFilter
      ? supabaseAdmin.from('category_shape_sizes').select('category_id, shape_size_id').eq('category_id', categoryFilter)
      : Promise.resolve({ data: [] as { category_id: number; shape_size_id: number }[] })
  ]);

  return (
    <>
      <h1>Shapes</h1>
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 18 }}>
        Master list of {shapes?.length || 0} shapes. Add new shapes or sizes here -- they'll then be selectable
        from the dropdown on any category. Expand "Categories" on any shape to link/unlink it from multiple
        categories at once, without leaving this page.
      </p>
      <ShapesClient
        key={query.category || 'all'}
        shapes={shapes || []}
        sizes={sizes || []}
        categories={categories || []}
        catShapes={catShapes || []}
        catSizes={catSizes || []}
        initialCategoryId={categoryFilter}
      />
    </>
  );
}

