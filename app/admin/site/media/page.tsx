import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import s from '@/components/admin/site/site-admin.module.css';
import MediaLibrary from './MediaLibrary';

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  const [{ data: media }, links, { data: cats }, { data: colors }, { data: shapes }, sizes] = await Promise.all([
    supabaseAdmin.from('site_media').select('id, storage_path, variants, width, height, alt, tags, created_at').order('created_at', { ascending: false }).limit(1000),
    fetchAllRows<{ media_id: number; target_type: string; target_id: number }>((from, to) =>
      supabaseAdmin.from('site_media_links').select('media_id, target_type, target_id', { count: 'exact' }).range(from, to)),
    supabaseAdmin.from('site_categories').select('id, name, parent_id, sort_order').order('sort_order'),
    supabaseAdmin.from('colors').select('id, name').order('sort_order'),
    supabaseAdmin.from('shapes').select('id, name').order('sort_order'),
    fetchAllRows<{ id: number; shape_id: number; size_mm: string }>((from, to) =>
      supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm', { count: 'exact' }).range(from, to))
  ]);
  // Label sub-categories with their parent so "Crystal" is unambiguous.
  const byId = new Map((cats || []).map((c) => [c.id, c]));
  const categoryOptions = (cats || []).map((c) => ({ id: c.id, name: c.parent_id ? `${byId.get(c.parent_id)?.name} › ${c.name}` : c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <div className={s.crumbs}><Link href="/admin/site">Website</Link> / Images</div>
      <h1>Website images</h1>
      <MediaLibrary
        initial={(media || []) as any}
        links={links.data || []}
        options={{ site_category: categoryOptions, color: colors || [], shape: shapes || [], size: (sizes.data || []).map((z) => ({ id: z.id, name: z.size_mm, shape_id: z.shape_id })) }}
      />
    </>
  );
}
