import { supabaseAdmin } from '@/lib/supabase-admin';
import SizePalettesClient from './SizePalettesClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function SizePalettesPage() {
  const [{ data: palettes }, { data: items }] = await Promise.all([
    supabaseAdmin.from('size_palettes').select('id, name').order('sort_order').order('name'),
    supabaseAdmin.from('size_palette_items').select('palette_id, size_mm')
  ]);

  const byPalette: Record<number, string[]> = {};
  (items || []).forEach((i: any) => {
    if (!byPalette[i.palette_id]) byPalette[i.palette_id] = [];
    byPalette[i.palette_id].push(i.size_mm);
  });

  return (
    <>
      <h1>Size Palettes</h1>
      <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 18, maxWidth: 640 }}>
        Group commonly-used sizes into named sets (e.g. "Melee Range") -- wherever a size dropdown supports
        palettes, checking one auto-selects every matching size for whichever shape is currently active (only
        sizes that actually exist for that shape get selected; the rest are simply skipped).
      </p>
      <SizePalettesClient palettes={(palettes || []).map((p: any) => ({ id: p.id, name: p.name, sizeMms: byPalette[p.id] || [] }))} />
    </>
  );
}
