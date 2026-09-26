import { unstable_cache } from 'next/cache';
import { supabasePublic } from '@/lib/supabase-public';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { photoUrl } from '@/lib/photos';
import { pickCategoryImages, type CategoryImage, type Row, type Source } from './category-images';
import type { MediaRow } from './media-url';

// Loads what pickCategoryImages needs. Cached and refreshed on admin edits.

type Photo = { id: number; category_id: number; storage_path: string | null; drive_id: string | null; cover_crop: any; photo_crop: any; is_cover_only: boolean | null };

async function load(): Promise<Record<number, CategoryImage>> {
  const [{ data: rows }, { data: sources }] = await Promise.all([
    supabasePublic.from('site_categories').select('id, parent_id, slug, name, hero_media_id, published, sort_order').order('sort_order'),
    supabasePublic.from('site_category_sources').select('site_category_id, category_id, sort_order').order('sort_order')
  ]);
  const siteRows = (rows || []) as Row[];
  const links = (sources || []) as Source[];
  const catIds = [...new Set(links.map((s) => s.category_id))];

  const mediaIds = [...new Set(siteRows.flatMap((r) => [r.hero_media_id, r.published?.hero?.image]).filter((n) => Number.isSafeInteger(n) && n > 0))];
  const [{ data: cats }, photoRows, { data: mediaRows }] = await Promise.all([
    catIds.length ? supabasePublic.from('categories').select('id, slug, thumbnail_photo_id').in('id', catIds) : Promise.resolve({ data: [] as any[] }),
    catIds.length
      ? fetchAllRows<Photo>((f, t) => supabasePublic.from('photos').select('id, category_id, storage_path, drive_id, cover_crop, photo_crop, is_cover_only', { count: 'exact' })
        .in('category_id', catIds).order('sort_order').order('id').range(f, t))
      : Promise.resolve({ data: [] as Photo[] }),
    mediaIds.length ? supabasePublic.from('site_media').select('id, storage_path, variants, width, height, alt').in('id', mediaIds) : Promise.resolve({ data: [] as any[] })
  ]);

  // Same rule as the /po catalogue cards.
  const photos = (photoRows.data || []) as Photo[];
  const byId = new Map(photos.map((p) => [p.id, p]));
  const thumbs = new Map<number, string>();
  const slugs = new Map<number, string>();
  for (const c of (cats || []) as { id: number; slug: string; thumbnail_photo_id: number | null }[]) {
    slugs.set(c.id, c.slug);
    const p = (c.thumbnail_photo_id ? byId.get(c.thumbnail_photo_id) : null) ?? photos.find((x) => x.category_id === c.id && !x.is_cover_only);
    const src = p ? photoUrl(p, 600, 'cover') : null;
    if (src) thumbs.set(c.id, src);
  }
  const media = new Map(((mediaRows || []) as any[]).map((m) => [m.id as number, m as MediaRow]));
  return pickCategoryImages(siteRows, links, slugs, thumbs, media);
}

export const getCategoryImages = unstable_cache(load, ['site-category-images'], { revalidate: 3600, tags: ['site'] });
