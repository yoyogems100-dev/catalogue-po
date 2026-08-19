import { supabaseAdmin } from '@/lib/supabase-admin';
import ColorsClient from './ColorsClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function ColorsPage() {
  const [{ data: colors }, { data: categories }, { data: catColors }, { data: palettesRaw }, { data: paletteItems }] = await Promise.all([
    supabaseAdmin.from('colors').select('id, name, hex_value, sort_order').order('sort_order').order('name'),
    supabaseAdmin.from('categories').select('id, num, name').order('num'),
    supabaseAdmin.from('category_colors').select('category_id, color_id'),
    supabaseAdmin.from('color_palettes').select('id, name').order('sort_order').order('name'),
    supabaseAdmin.from('color_palette_items').select('palette_id, color_id')
  ]);

  const byPalette: Record<number, number[]> = {};
  (paletteItems || []).forEach((i: any) => {
    if (!byPalette[i.palette_id]) byPalette[i.palette_id] = [];
    byPalette[i.palette_id].push(i.color_id);
  });
  const palettes = (palettesRaw || []).map((p: any) => ({ id: p.id, name: p.name, colorIds: byPalette[p.id] || [] }));

  return (
    <>
      <h1>Colors</h1>
      <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 18 }}>
        Master list of {colors?.length || 0} colors. Add more any time -- they'll show up in every category's
        color dropdown. Click a swatch to change its hex. Expand "Categories" on any color to link/unlink it
        from multiple categories at once.
      </p>
      <ColorsClient colors={colors || []} categories={categories || []} catColors={catColors || []} palettes={palettes} />
    </>
  );
}
