import { supabaseAdmin } from '@/lib/supabase-admin';
import CategoriesClient, { type TreeRow } from './CategoriesClient';

export const dynamic = 'force-dynamic';

export default async function SiteCategoriesPage() {
  const [{ data: rows }, { data: sources }] = await Promise.all([
    supabaseAdmin.from('site_categories').select('id, parent_id, slug, name, sort_order, is_visible, published_at, updated_at').order('sort_order'),
    supabaseAdmin.from('site_category_sources').select('site_category_id')
  ]);
  const sourceCount = new Map<number, number>();
  (sources || []).forEach((r) => sourceCount.set(r.site_category_id, (sourceCount.get(r.site_category_id) || 0) + 1));
  const tree: TreeRow[] = (rows || []).map((r) => ({ ...r, sources: sourceCount.get(r.id) || 0 }));
  return <CategoriesClient rows={tree} />;
}
