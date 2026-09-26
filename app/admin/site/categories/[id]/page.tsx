import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { categorySchema } from '@/lib/site/schemas';
import { collectImageIds, withDefaults } from '@/lib/site/schema';
import type { MediaRow } from '@/lib/site/media-url';
import ContentEditor from '@/components/admin/site/ContentEditor';
import s from '@/components/admin/site/site-admin.module.css';
import DetailsForm from './DetailsForm';
import SourcesForm from './SourcesForm';
import GalleryEditor from './GalleryEditor';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'text', label: 'Page text' },
  { key: 'catalogue', label: 'Catalogue & filters' },
  { key: 'gallery', label: 'Gallery' }
];

const MEDIA_COLS = 'id, storage_path, variants, width, height, alt, tags';

export default async function EditSiteCategory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const id = Number((await params).id);
  const requested = (await searchParams).tab;
  const tab = TABS.some((t) => t.key === requested) ? requested! : 'details';
  if (!Number.isSafeInteger(id)) notFound();
  const { data: cat } = await supabaseAdmin.from('site_categories').select('*').eq('id', id).maybeSingle();
  if (!cat) notFound();
  const { data: parent } = cat.parent_id
    ? await supabaseAdmin.from('site_categories').select('id, slug, name').eq('id', cat.parent_id).maybeSingle()
    : { data: null };
  const viewHref = parent ? `/products/${parent.slug}/${cat.slug}` : `/products/${cat.slug}`;

  let body: React.ReactNode = null;
  if (tab === 'details') {
    const [{ data: tops }, { count: childCount }, heroMedia] = await Promise.all([
      supabaseAdmin.from('site_categories').select('id, name').is('parent_id', null).neq('id', id).order('sort_order'),
      supabaseAdmin.from('site_categories').select('id', { count: 'exact', head: true }).eq('parent_id', id),
      cat.hero_media_id ? supabaseAdmin.from('site_media').select(MEDIA_COLS).eq('id', cat.hero_media_id).maybeSingle() : Promise.resolve({ data: null })
    ]);
    body = <DetailsForm category={cat} parents={tops || []} hasChildren={!!childCount} tileMedia={(heroMedia.data as MediaRow) || null} parentSlug={parent?.slug || null} />;
  } else if (tab === 'text') {
    const draft = withDefaults(categorySchema, cat.draft);
    const ids = collectImageIds(categorySchema, draft);
    const { data: media } = ids.length ? await supabaseAdmin.from('site_media').select(MEDIA_COLS).in('id', ids) : { data: [] };
    body = <ContentEditor entity="category" entityKey={String(id)} initialDraft={cat.draft} initialPublished={cat.published}
      publishedAt={cat.published_at} viewHref={viewHref} media={(media || []) as MediaRow[]} />;
  } else if (tab === 'catalogue') {
    const [{ data: catalogue }, { data: grades }, { data: sources }, { data: catGrades }, { data: colors }] = await Promise.all([
      supabaseAdmin.from('categories').select('id, name').order('num'),
      supabaseAdmin.from('site_grades').select('id, name').order('sort_order'),
      supabaseAdmin.from('site_category_sources').select('category_id, grade_id, color_ids').eq('site_category_id', id).order('sort_order'),
      supabaseAdmin.from('site_category_grades').select('grade_id').eq('site_category_id', id),
      supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url').order('sort_order')
    ]);
    const [categoryColors, categoryShapes] = await Promise.all([
      fetchAllRows<{ category_id: number; color_id: number }>((from, to) => supabaseAdmin.from('category_colors').select('category_id, color_id', { count: 'exact' }).range(from, to)),
      fetchAllRows<{ category_id: number; shape_id: number }>((from, to) => supabaseAdmin.from('category_shapes').select('category_id, shape_id', { count: 'exact' }).range(from, to))
    ]);
    const { data: shapes } = await supabaseAdmin.from('shapes').select('id, name').order('sort_order');
    body = <SourcesForm siteCategoryId={id} filters={cat.filters} catalogue={catalogue || []} grades={grades || []}
      initialSources={sources || []} initialGrades={(catGrades || []).map((g) => g.grade_id)}
      colors={colors || []} shapes={shapes || []} categoryColors={categoryColors.data || []} categoryShapes={categoryShapes.data || []} />;
  } else {
    const { data: links } = await supabaseAdmin.from('site_media_links').select('media_id, sort_order')
      .eq('target_type', 'site_category').eq('target_id', id).order('sort_order');
    const ids = (links || []).map((l) => l.media_id);
    const { data: media } = ids.length ? await supabaseAdmin.from('site_media').select(MEDIA_COLS).in('id', ids) : { data: [] };
    const byId = new Map((media || []).map((m: any) => [m.id, m]));
    body = <GalleryEditor siteCategoryId={id} initial={ids.map((mid) => byId.get(mid)).filter(Boolean) as MediaRow[]} />;
  }

  return (
    <>
      <div className={s.crumbs}>
        <Link href="/admin/site">Website</Link> / <Link href="/admin/site/categories">Categories</Link>
        {parent && <> / <Link href={`/admin/site/categories/${parent.id}`}>{parent.name}</Link></>} / {cat.name}
      </div>
      <div className={s.pageHead}>
        <div>
          <h1>{cat.name}{!cat.is_visible && <span className={`${s.pill} ${s.pillHidden}`}>Hidden</span>}</h1>
          <p className={s.note}>{parent ? `Sub-category of ${parent.name}` : 'Top-level category'} · <a href={viewHref} target="_blank" rel="noopener noreferrer">{viewHref} ↗</a></p>
        </div>
      </div>
      <nav className={s.tabs} aria-label="Category sections">
        {TABS.map((t) => <Link key={t.key} href={`?tab=${t.key}`} aria-current={t.key === tab ? 'page' : undefined}>{t.label}</Link>)}
      </nav>
      {body}
    </>
  );
}
