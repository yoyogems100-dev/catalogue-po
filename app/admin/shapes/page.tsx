import { supabaseAdmin } from '@/lib/supabase-admin';
import ShapesClient from './ShapesClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function ShapesPage() {
  const [{ data: shapes }, { data: sizes }, { data: categories }, { data: catShapes }, { data: sizePalettesRaw }, { data: sizePaletteItems }] =
    await Promise.all([
      supabaseAdmin.from('shapes').select('id, name, sort_order').order('sort_order').order('name'),
      supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm, weight_ct').order('id'),
      supabaseAdmin.from('categories').select('id, num, name').order('num'),
      supabaseAdmin.from('category_shapes').select('category_id, shape_id'),
      supabaseAdmin.from('size_palettes').select('id, name').order('sort_order').order('name'),
      supabaseAdmin.from('size_palette_items').select('palette_id, size_mm')
    ]);

  const byPalette: Record<number, string[]> = {};
  (sizePaletteItems || []).forEach((i: any) => {
    if (!byPalette[i.palette_id]) byPalette[i.palette_id] = [];
    byPalette[i.palette_id].push(i.size_mm);
  });
  const sizePalettes = (sizePalettesRaw || []).map((p: any) => ({ id: p.id, name: p.name, sizeMms: byPalette[p.id] || [] }));

  return (
    <>
      <h1>Shapes</h1>
      <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 18 }}>
        Master list of {shapes?.length || 0} shapes. Add new shapes or sizes here -- they'll then be selectable
        from the dropdown on any category. Expand "Categories" on any shape to link/unlink it from multiple
        categories at once, without leaving this page.
      </p>
      <ShapesClient
        shapes={shapes || []}
        sizes={sizes || []}
        categories={categories || []}
        catShapes={catShapes || []}
        sizePalettes={sizePalettes}
      />
    </>
  );
}

