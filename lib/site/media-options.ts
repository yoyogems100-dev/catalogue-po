import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';

// What a website photo can be shown on or tagged with, for the admin editors.
export async function loadMediaOptions() {
  const [{ data: cats }, { data: colors }, { data: shapes }, sizes, { data: grades }] = await Promise.all([
    supabaseAdmin.from('site_categories').select('id, name, parent_id, sort_order').order('sort_order'),
    supabaseAdmin.from('colors').select('id, name').order('sort_order'),
    supabaseAdmin.from('shapes').select('id, name').order('sort_order'),
    fetchAllRows<{ id: number; shape_id: number; size_mm: string }>((from, to) =>
      supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm', { count: 'exact' }).range(from, to)),
    supabaseAdmin.from('site_grades').select('id, name').order('sort_order')
  ]);
  // Label sub-categories with their parent so "Crystal" is unambiguous.
  const byId = new Map((cats || []).map((c) => [c.id, c]));
  const categoryOptions = (cats || []).map((c) => ({ id: c.id, name: c.parent_id ? `${byId.get(c.parent_id)?.name} › ${c.name}` : c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    site_category: categoryOptions,
    color: colors || [],
    shape: shapes || [],
    size: (sizes.data || []).map((z) => ({ id: z.id, name: z.size_mm, shape_id: z.shape_id })),
    grade: grades || []
  };
}
