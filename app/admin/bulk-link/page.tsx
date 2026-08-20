import { supabaseAdmin } from '@/lib/supabase-admin';
import BulkLinkClient from './BulkLinkClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function BulkLinkPage() {
  const [{ data: shapes }, { data: colors }, { data: categories }, { data: colorPalettesRaw }, { data: colorPaletteItems }] = await Promise.all([
    supabaseAdmin.from('shapes').select('id, name').order('sort_order').order('name'),
    supabaseAdmin.from('colors').select('id, name, hex_value').order('sort_order').order('name'),
    supabaseAdmin.from('categories').select('id, num, name').order('num'),
    supabaseAdmin.from('color_palettes').select('id, name').order('sort_order').order('name'),
    supabaseAdmin.from('color_palette_items').select('palette_id, color_id')
  ]);

  const colorPalettes = (colorPalettesRaw || [])
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      memberIds: (colorPaletteItems || []).filter((i: any) => i.palette_id === p.id).map((i: any) => i.color_id)
    }))
    .filter((p) => p.memberIds.length > 0);

  return (
    <>
      <h1>Bulk Link</h1>
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 18, maxWidth: 640 }}>
        Link several shapes and/or colors to several categories in one action -- e.g. pick 3 shapes and 4
        categories to create all 12 links at once, instead of visiting each shape or category individually.
        Existing links are left as-is; nothing gets unlinked here.
      </p>
      <BulkLinkClient
        shapes={(shapes || []).map((s: any) => ({ id: s.id, name: s.name }))}
        colors={(colors || []).map((c: any) => ({ id: c.id, name: c.name, hex_value: c.hex_value }))}
        categories={(categories || []).map((c: any) => ({ id: c.id, num: c.num, name: c.name }))}
        colorPalettes={colorPalettes}
      />
    </>
  );
}
