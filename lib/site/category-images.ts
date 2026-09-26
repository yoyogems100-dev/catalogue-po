import { categoryIconUrl } from '@/lib/category-icons';
import { mediaSrc, mediaSrcSet, type MediaRow } from './media-url';

type Img = { src: string; srcSet?: string; alt: string; width?: number; height?: number };

// One picture per website category, for tiles, menus and chips. In order:
// the image chosen for the category in Admin → Website → the clean gemstone
// cut-out /po shows beside that catalogue category in its dropdowns (a
// larger copy, see scripts/make-category-icons.mjs) → the catalogue
// category's own photo → for a main category, its first sub-category's.

export type CategoryImage = Img & { cutout?: boolean };

/** The high-resolution transparent cut-out for a catalogue category slug. */
export function cutoutFor(catalogueSlug: string | null | undefined): string | null {
  const small = categoryIconUrl(catalogueSlug);
  return small ? small.replace('/reference/categories/', '/reference/categories/hd2/').replace(/\.png$/, '.webp') : null;
}

export type Row = { id: number; parent_id: number | null; slug: string; name: string; hero_media_id: number | null; published: any };
export type Source = { site_category_id: number; category_id: number };

/** Pure: pick each category's picture from already-loaded rows. */
export function pickCategoryImages(
  rows: Row[], sources: Source[], catalogueSlug: Map<number, string>, catalogueThumb: Map<number, string>, media: Map<number, MediaRow>
): Record<number, CategoryImage> {
  const out: Record<number, CategoryImage> = {};
  const own = (r: Row): CategoryImage | null => {
    const alt = `${r.name} stones`;
    const m = media.get(r.hero_media_id as number) ?? media.get(r.published?.hero?.image);
    if (m) return { src: mediaSrc(m, 960), srcSet: mediaSrcSet(m), alt: m.alt || alt, width: m.width ?? undefined, height: m.height ?? undefined };
    const mine = sources.filter((x) => x.site_category_id === r.id);
    for (const s of mine) {
      const src = cutoutFor(catalogueSlug.get(s.category_id));
      if (src) return { src, alt, cutout: true };
    }
    for (const s of mine) {
      const src = catalogueThumb.get(s.category_id);
      if (src) return { src, alt };
    }
    return null;
  };
  for (const r of rows) { const img = own(r); if (img) out[r.id] = img; }
  for (const r of rows.filter((x) => x.parent_id === null && !out[x.id])) {
    const child = rows.find((c) => c.parent_id === r.id && out[c.id]);
    if (child) out[r.id] = { ...out[child.id], alt: `${r.name} stones` };
  }
  return out;
}
