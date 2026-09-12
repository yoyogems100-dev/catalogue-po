import { supabaseAdmin } from '@/lib/supabase-admin';
import ColorsClient from './ColorsClient';

export async function ColorsWorkspace({ initialCategoryId, embedded = false }: { initialCategoryId?: number; embedded?: boolean }) {
  const [{ data: colors }, { data: categories }, { data: catColors }, { data: palettesRaw }, { data: paletteItems }] = await Promise.all([
    supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url, sort_order').order('sort_order').order('name'),
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
      {!embedded && <h1>Colors</h1>}
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 18 }}>
        Manage color names and reference photos. Filter by category to see its linked colors. Editing a shared color changes it in every category using that color.
      </p>
      <ColorsClient key={`${embedded}-${initialCategoryId || 0}`} colors={colors || []} categories={categories || []} catColors={catColors || []} palettes={palettes} initialCategoryId={initialCategoryId} lockedCategory={embedded} />
    </>
  );
}
