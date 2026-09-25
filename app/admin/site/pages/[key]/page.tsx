import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { pageSchemas } from '@/lib/site/page-schemas';
import { pageDefaults } from '@/lib/site/defaults';
import { collectImageIds, withDefaults } from '@/lib/site/schema';
import type { MediaRow } from '@/lib/site/media-url';
import ContentEditor from '@/components/admin/site/ContentEditor';
import s from '@/components/admin/site/site-admin.module.css';
import { PAGE_LIST } from '@/lib/site/page-list';

export const dynamic = 'force-dynamic';

export default async function EditSitePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const schema = pageSchemas[key];
  const meta = PAGE_LIST.find((p) => p.key === key);
  if (!schema || !meta) notFound();
  const { data: row } = await supabaseAdmin.from('site_pages').select('draft, published, published_at').eq('key', key).maybeSingle();
  if (!row) notFound();
  // A page never edited opens with the starting text the live site shows.
  const draft = row.draft && Object.keys(row.draft).length ? row.draft : pageDefaults[key] || {};
  const ids = collectImageIds(schema, withDefaults(schema, draft));
  const { data: media } = ids.length ? await supabaseAdmin.from('site_media').select('id, storage_path, variants, width, height, alt, tags').in('id', ids) : { data: [] };
  return (
    <>
      <div className={s.crumbs}><Link href="/admin/site">Website</Link> / <Link href="/admin/site/pages">Pages</Link> / {meta.title}</div>
      <h1>{meta.title}</h1>
      <ContentEditor entity="page" entityKey={key} initialDraft={draft} initialPublished={row.published}
        publishedAt={row.published_at} viewHref={meta.href} media={(media || []) as MediaRow[]} />
    </>
  );
}
