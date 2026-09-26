import { unstable_cache } from 'next/cache';
import { supabasePublic } from '@/lib/supabase-public';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { pickCategoryImages, type CategoryImage, type Row, type Source } from './category-images';
import type { MediaRow } from './media-url';

// Loads what pickCategoryImages needs. Cached and refreshed on admin edits.

async function load(): Promise<Record<number, CategoryImage>> {
  const [{ data: rows }, { data: sources }, photoLinks] = await Promise.all([
    supabasePublic.from('site_categories').select('id, parent_id, slug, name, hero_media_id, published, sort_order').order('sort_order'),
    supabasePublic.from('site_category_sources').select('site_category_id, category_id, sort_order').order('sort_order'),
    fetchAllRows<{ media_id: number; target_id: number; sort_order: number }>((f, t) => supabasePublic.from('site_media_links')
      .select('media_id, target_id, sort_order', { count: 'exact' }).eq('target_type', 'site_category').order('sort_order').range(f, t))
  ]);
  const siteRows = (rows || []) as Row[];
  const links = (sources || []) as Source[];
  const catIds = [...new Set(links.map((s) => s.category_id))];

  // Each website category's first own photo (the website's copy, not /po's).
  const firstPhotoId = new Map<number, number>();
  for (const l of photoLinks.data || []) if (!firstPhotoId.has(l.target_id)) firstPhotoId.set(l.target_id, l.media_id);

  const mediaIds = [...new Set([...siteRows.flatMap((r) => [r.hero_media_id, r.published?.hero?.image]), ...firstPhotoId.values()]
    .filter((n) => Number.isSafeInteger(n) && n > 0))];
  const [{ data: cats }, { data: mediaRows }] = await Promise.all([
    catIds.length ? supabasePublic.from('categories').select('id, slug').in('id', catIds) : Promise.resolve({ data: [] as any[] }),
    mediaIds.length ? supabasePublic.from('site_media').select('id, storage_path, variants, width, height, alt').in('id', mediaIds) : Promise.resolve({ data: [] as any[] })
  ]);
  const slugs = new Map(((cats || []) as { id: number; slug: string }[]).map((c) => [c.id, c.slug]));
  const media = new Map(((mediaRows || []) as any[]).map((m) => [m.id as number, m as MediaRow]));
  const firstPhoto = new Map([...firstPhotoId].filter(([, id]) => media.has(id)).map(([cat, id]) => [cat, media.get(id)!]));
  return pickCategoryImages(siteRows, links, slugs, firstPhoto, media);
}

export const getCategoryImages = unstable_cache(load, ['site-category-images'], { revalidate: 3600, tags: ['site'] });
