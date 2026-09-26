import { cache } from 'react';
import { supabasePublic } from '@/lib/supabase-public';
import { withDefaults, type ContentValue } from './schema';
import { pageSchemas } from './page-schemas';
import { pageDefaults } from './defaults';
import { mediaSrc, mediaSrcSet, type MediaRow } from './media-url';
import { getCategoryImages } from './category-images-data';

// Read-side of the public website. Uses the anon key, so it can only ever see
// published content (column grants hide drafts), and every function falls
// back to sensible defaults so a missing row never breaks a page.

/** cutout: a transparent single-stone picture, shown whole rather than cropped. */
export type PublicImage = { src: string; srcSet?: string; alt: string; width?: number; height?: number; cutout?: boolean };

export type NavCategory = {
  id: number;
  slug: string;
  name: string;
  descriptor: string;
  href: string;
  image: PublicImage | null;
  children: { id: number; slug: string; name: string; href: string; image: PublicImage | null }[];
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

/** Visible website categories as a two-level tree, with a picture each. */
export const getNavTree = cache(async (): Promise<NavCategory[]> => {
  const [{ data: rows }, images] = await Promise.all([
    supabasePublic.from('site_categories').select('id, parent_id, slug, name, descriptor, sort_order').order('sort_order'),
    getCategoryImages()
  ]);
  const all = (rows || []) as any[];
  return all.filter((r) => r.parent_id === null).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    descriptor: r.descriptor,
    href: `/products/${r.slug}`,
    image: images[r.id] ?? null,
    children: all.filter((c) => c.parent_id === r.id)
      .map((c) => ({ id: c.id, slug: c.slug, name: c.name, href: `/products/${r.slug}/${c.slug}`, image: images[c.id] ?? null }))
  }));
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
