import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { loadMediaOptions } from '@/lib/site/media-options';
import s from '@/components/admin/site/site-admin.module.css';
import MediaLibrary from './MediaLibrary';

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  const [{ data: media }, links, options] = await Promise.all([
    supabaseAdmin.from('site_media').select('id, storage_path, variants, width, height, alt, tags, created_at').order('created_at', { ascending: false }).limit(1000),
    fetchAllRows<{ media_id: number; target_type: string; target_id: number }>((from, to) =>
      supabaseAdmin.from('site_media_links').select('media_id, target_type, target_id', { count: 'exact' }).range(from, to)),
    loadMediaOptions()
  ]);
  return (
    <>
      <div className={s.crumbs}><Link href="/admin/site">Website</Link> / Photos &amp; images</div>
      <h1>Website photos &amp; images</h1>
      <p className={s.note}>Every picture used on the public website. These are the website’s own copies: deleting one here never touches the /po catalogue photos, and /po changes never appear here. To arrange a category’s photos, open it under <Link href="/admin/site/categories">Categories</Link> → Photos.</p>
      <MediaLibrary initial={(media || []) as any} links={links.data || []} options={options} />
    </>
  );
}
