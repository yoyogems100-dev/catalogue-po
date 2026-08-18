import { supabaseAdmin } from '@/lib/supabase-admin';
import ColorPalettesClient from './ColorPalettesClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function ColorPalettesPage() {
  const [{ data: palettes }, { data: items }, { data: colors }] = await Promise.all([
    supabaseAdmin.from('color_palettes').select('id, name').order('sort_order').order('name'),
    supabaseAdmin.from('color_palette_items').select('palette_id, color_id'),
    supabaseAdmin.from('colors').select('id, name, hex_value').order('sort_order').order('name')
  ]);

  const byPalette: Record<number, number[]> = {};
  (items || []).forEach((i: any) => {
    if (!byPalette[i.palette_id]) byPalette[i.palette_id] = [];
    byPalette[i.palette_id].push(i.color_id);
  });

  return (
    <>
      <h1>Color Palettes</h1>
      <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 18, maxWidth: 640 }}>
        Group colors into named sets (e.g. "Excellent Star CP") -- palettes show up as one-click quick-selects at
        the top of color dropdowns everywhere, auto-selecting every color in the set (individual colors can still
        be unchecked afterward).
      </p>
      <ColorPalettesClient
        palettes={(palettes || []).map((p: any) => ({ id: p.id, name: p.name, colorIds: byPalette[p.id] || [] }))}
        colors={(colors || []).map((c: any) => ({ id: c.id, name: c.name, hex_value: c.hex_value }))}
      />
    </>
  );
}
