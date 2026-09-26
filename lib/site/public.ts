import { cache } from 'react';
import { supabasePublic } from '@/lib/supabase-public';
import { photoUrl } from '@/lib/photos';
import { withDefaults, type ContentValue } from './schema';
import { pageSchemas } from './page-schemas';
import { pageDefaults } from './defaults';
import { mediaSrc, mediaSrcSet, type MediaRow } from './media-url';

// Read-side of the public website. Uses the anon key, so it can only ever see
// published content (column grants hide drafts), and every function falls
// back to sensible defaults so a missing row never breaks a page.

export type PublicImage = { src: string; srcSet?: string; alt: string; width?: number; height?: number };

export type NavCategory = {
  id: number;
  slug: string;
  name: string;
  descriptor: string;
  href: string;
  image: PublicImage | null;
  children: { id: number; slug: string; name: string; href: string }[];
};

export const getPage = cache(async (key: string): Promise<ContentValue> => {
  const schema = pageSchemas[key];
  const { data } = await supabasePublic.from('site_pages').select('published').eq('key', key).maybeSingle();
  const published = data?.published as ContentValue | null | undefined;
  return schema ? withDefaults(schema, published ?? pageDefaults[key] ?? {}) : (published ?? pageDefaults[key] ?? {});
});

export const getGlobal = cache(() => getPage('global'));

export function toImage(m: MediaRow | null | undefined, fallbackAlt = ''): PublicImage | null {
  if (!m) return null;
  return { src: mediaSrc(m, 960), srcSet: mediaSrcSet(m), alt: m.alt || fallbackAlt, width: m.width ?? undefined, height: m.height ?? undefined };
}

export const getMedia = cache(async (ids: number[]): Promise<Map<number, MediaRow>> => {
  const unique = [...new Set(ids.filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (!unique.length) return new Map();
  const { data } = await supabasePublic.from('site_media').select('id, storage_path, variants, width, height, alt').in('id', unique);
  return new Map((data || []).map((m: any) => [m.id, m as MediaRow]));
});

/** Visible website categories as a two-level tree, with a tile image each. */
export const getNavTree = cache(async (): Promise<NavCategory[]> => {
  const [{ data: rows }, { data: sources }] = await Promise.all([
    supabasePublic.from('site_categories').select('id, parent_id, slug, name, descriptor, sort_order, hero_media_id, published').order('sort_order'),
    supabasePublic.from('site_category_sources').select('site_category_id, category_id, sort_order').order('sort_order')
  ]);
  const all = (rows || []) as any[];
  const top = all.filter((r) => r.parent_id === null);
  const visibleIds = new Set(all.map((r) => r.id));
  const childrenOf = (id: number) => all.filter((r) => r.parent_id === id && visibleIds.has(id));

  // Tile image: chosen tile image → published hero image → the first
  // catalogue cover photo (stored in Supabase, not a Drive link, which can
  // expire) among the category's and its sub-categories' sources.
  const mediaIds = top.flatMap((r) => [r.hero_media_id, r.published?.hero?.image]).filter(Boolean);
  const media = await getMedia(mediaIds);
  const sourcesOf = (id: number) => (sources || []).filter((s: any) => s.site_category_id === id).map((s: any) => s.category_id as number);
  const candidateIds = (id: number) => [...sourcesOf(id), ...childrenOf(id).flatMap((c) => sourcesOf(c.id))];
  const allCandidates = [...new Set(top.flatMap((r) => candidateIds(r.id)))];
  const covers = new Map<number, PublicImage>();
  if (allCandidates.length) {
    const { data: cats } = await supabasePublic.from('categories').select('id, name, thumbnail_photo_id').in('id', allCandidates);
    const photoIds = (cats || []).map((c: any) => c.thumbnail_photo_id).filter(Boolean);
    const { data: photos } = photoIds.length
      ? await supabasePublic.from('photos').select('id, storage_path, cover_crop, photo_crop').in('id', photoIds).not('storage_path', 'is', null)
      : { data: [] };
    for (const c of cats || []) {
      const p = (photos || []).find((x: any) => x.id === (c as any).thumbnail_photo_id);
      const src = p ? photoUrl(p as any, 600, 'cover') : null;
      if (src) covers.set((c as any).id, { src, alt: `${(c as any).name} stones` });
    }
  }

  return top.map((r) => {
    const tileMedia = media.get(r.hero_media_id) ?? media.get(r.published?.hero?.image);
    const coverId = candidateIds(r.id).find((id) => covers.has(id));
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      descriptor: r.descriptor,
      href: `/products/${r.slug}`,
      image: toImage(tileMedia, `${r.name} stones`) ?? (coverId ? covers.get(coverId) ?? null : null),
      children: childrenOf(r.id).map((c) => ({ id: c.id, slug: c.slug, name: c.name, href: `/products/${r.slug}/${c.slug}` }))
    };
  });
});

/** A row of real shape and colour photos for the charts teaser. */
export const getChartTeaser = cache(async () => {
  const [{ data: shapes }, { data: colors }] = await Promise.all([
    supabasePublic.from('shapes').select('id, name, ref_photo_url').not('ref_photo_url', 'is', null).order('sort_order').limit(14),
    supabasePublic.from('colors').select('id, name, ref_photo_url').not('ref_photo_url', 'is', null).order('sort_order').limit(60)
  ]);
  // One swatch per colour name (the same colour exists per material).
  const seen = new Set<string>();
  const uniqueColors = (colors || []).filter((c: any) => {
    const k = c.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 18);
  return {
    shapes: (shapes || []).map((s: any) => ({ name: s.name as string, src: s.ref_photo_url as string })),
    colors: uniqueColors.map((c: any) => ({ name: c.name as string, src: c.ref_photo_url as string }))
  };
});

export function whatsappHref(number: string, message: string) {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function telHref(phone: string) {
  const digits = (phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export const getFaqs = cache(async (): Promise<{ id: number; question: string; answer: string }[]> => {
  const { data } = await supabasePublic.from('site_faqs').select('id, question, answer, sort_order').order('sort_order').order('id');
  return (data || []).map((f: any) => ({ id: f.id, question: f.question, answer: f.answer }));
});
