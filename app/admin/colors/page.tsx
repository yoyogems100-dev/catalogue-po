import { supabaseAdmin } from '@/lib/supabase-admin';
import ColorsClient from './ColorsClient';

export default async function ColorsPage() {
  const [{ data: colors }, { data: categories }, { data: catColors }] = await Promise.all([
    supabaseAdmin.from('colors').select('id, name, hex_value, sort_order').order('sort_order').order('name'),
    supabaseAdmin.from('categories').select('id, num, name').order('num'),
    supabaseAdmin.from('category_colors').select('category_id, color_id')
  ]);

  return (
    <>
      <h1>Colors</h1>
      <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 18 }}>
        Master list of {colors?.length || 0} colors. Add more any time -- they'll show up in every category's
        color dropdown. Click a swatch to change its hex. Expand "Categories" on any color to link/unlink it
        from multiple categories at once.
      </p>
      <ColorsClient colors={colors || []} categories={categories || []} catColors={catColors || []} />
    </>
  );
}
