import { unstable_cache } from 'next/cache';
import { supabasePublic } from '@/lib/supabase-public';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { photoUrl } from '@/lib/photos';
import { withDefaults, type ContentValue } from './schema';
import { categorySchema } from './schemas';
import { categoryDefaults } from './category-defaults';
import { mediaSrc, mediaSrcSet, type MediaRow } from './media-url';
import { slugOf, sizeBucketOf, SIZE_BUCKETS } from './filters';

// Everything a category page needs, read with the anon key and cached for an
// hour (and dropped immediately when the admin changes website content).
// Shapes, sizes, colours and photos come from the catalogue categories the
// page is linked to; nothing is duplicated.

export type Option = { slug: string; name: string; img?: string | null; ids: number[] };
export type PagePhoto = { id: number; src: string; alt: string; shapes: string[]; colours: string[]; sizes: string[]; grade: string | null };
export type Img = { src: string; srcSet?: string; alt: string; width?: number; height?: number };

export type CategoryPage = {
  id: number;
  slug: string;
  name: string;
  descriptor: string;
  href: string;
  parent: { slug: string; name: string; href: string } | null;
  filters: { shape: boolean; size: boolean; colour: boolean; grade: boolean };
  content: ContentValue;
  heroImage: Img | null;
  children: { slug: string; name: string; descriptor: string; href: string; image: Img | null }[];
  siblings: { slug: string; name: string; href: string }[];
  shapes: Option[];
  sizes: Option[];            // mm ranges
  colours: Option[];
  grades: (Option & { summary: string })[];
  sizeChart: { shape: string; slug: string; sizes: string[] }[];
  colourCharts: { src: string; name: string }[];
  photos: PagePhoto[];
  gallery: Img[];
  sourceCount: number;
};

function toImg(m: MediaRow | undefined, alt: string): Img | null {
  return m ? { src: mediaSrc(m, 960), srcSet: mediaSrcSet(m), alt: m.alt || alt, width: m.width ?? undefined, height: m.height ?? undefined } : null;
}

function addOption(map: Map<string, Option>, name: string, id: number, img?: string | null) {
  const slug = slugOf(name);
  if (!slug) return;
  const existing = map.get(slug);
  if (existing) { if (!existing.ids.includes(id)) existing.ids.push(id); if (!existing.img && img) existing.img = img; }
  else map.set(slug, { slug, name, img: img || null, ids: [id] });
}

async function load(parentSlug: string | null, slug: string): Promise<CategoryPage | null> {
  // 1. The page itself, its parent and children.
  const { data: tops } = await supabasePublic.from('site_categories')
    .select('id, parent_id, slug, name, descriptor, filters, hero_media_id, published, sort_order').order('sort_order');
  const all = (tops || []) as any[];
  const parent = parentSlug ? all.find((c) => c.parent_id === null && c.slug === parentSlug) : null;
  if (parentSlug && !parent) return null;
  const node = all.find((c) => c.slug === slug && (parent ? c.parent_id === parent.id : c.parent_id === null));
  if (!node) return null;
  const kids = all.filter((c) => c.parent_id === node.id);
  const siblings = parent ? all.filter((c) => c.parent_id === parent.id) : [];
  const base = parent ? `/products/${parent.slug}` : '/products';

  // 2. Catalogue sources (a top-level page also draws on its sub-categories).
  const pageIds = [node.id, ...kids.map((k) => k.id)];
  const [{ data: sourceRows }, { data: gradeRows }, { data: allGrades }, { data: galleryLinks }] = await Promise.all([
    supabasePublic.from('site_category_sources').select('site_category_id, category_id, grade_id, color_ids, sort_order').in('site_category_id', pageIds).order('sort_order'),
    supabasePublic.from('site_category_grades').select('grade_id').in('site_category_id', pageIds),
    supabasePublic.from('site_grades').select('id, code, name, summary, sort_order').order('sort_order'),
    supabasePublic.from('site_media_links').select('media_id, sort_order').eq('target_type', 'site_category').eq('target_id', node.id).order('sort_order')
  ]);
  const sources = (sourceRows || []) as { site_category_id: number; category_id: number; grade_id: number | null; color_ids: number[] | null }[];
  const catIds = [...new Set(sources.map((s) => s.category_id))];
  const gradeById = new Map((allGrades || []).map((g: any) => [g.id, g]));

  // 3. Catalogue facts for those sources.
  const none = { data: [] as any[] };
  const [catRows, catShapes, catColors, catSizes] = catIds.length ? await Promise.all([
    supabasePublic.from('categories').select('id, name, color_chart_url, thumbnail_photo_id').in('id', catIds),
    fetchAllRows<any>((f, t) => supabasePublic.from('category_shapes').select('category_id, shape_id, ref_photo_url', { count: 'exact' }).in('category_id', catIds).range(f, t)),
    fetchAllRows<any>((f, t) => supabasePublic.from('category_colors').select('category_id, color_id', { count: 'exact' }).in('category_id', catIds).range(f, t)),
    fetchAllRows<any>((f, t) => supabasePublic.from('category_shape_sizes').select('category_id, shape_size_id', { count: 'exact' }).in('category_id', catIds).range(f, t))
  ]) : [none, none, none, none];

  const shapeIds = [...new Set((catShapes.data || []).map((r: any) => r.shape_id))];
  const allowedColor = (catId: number, colorId: number) => sources.some((s) => s.category_id === catId && (!s.color_ids || s.color_ids.includes(colorId)));
  const colorIds = [...new Set((catColors.data || []).filter((r: any) => allowedColor(r.category_id, r.color_id)).map((r: any) => r.color_id))];
  const sizeIds = [...new Set((catSizes.data || []).map((r: any) => r.shape_size_id))];

  const [{ data: shapes }, { data: colors }, sizeRows, photoRows] = await Promise.all([
    shapeIds.length ? supabasePublic.from('shapes').select('id, name, ref_photo_url, sort_order').in('id', shapeIds).order('sort_order') : Promise.resolve(none),
    colorIds.length ? supabasePublic.from('colors').select('id, name, ref_photo_url, sort_order').in('id', colorIds).order('sort_order') : Promise.resolve(none),
    sizeIds.length ? fetchAllRows<any>((f, t) => supabasePublic.from('shape_sizes').select('id, shape_id, size_mm', { count: 'exact' }).in('id', sizeIds).range(f, t)) : Promise.resolve(none),
    catIds.length ? supabasePublic.from('photos')
      .select('id, category_id, storage_path, photo_crop, cover_crop, watermarked_path, shape_id, color_id, shape_size_id, sort_order')
      .in('category_id', catIds).is('parent_photo_id', null).not('storage_path', 'is', null).or('is_cover_only.is.null,is_cover_only.eq.false')
      .order('sort_order').limit(400) : Promise.resolve(none)
  ]);

  // Options, de-duplicated by name (the same colour exists per material).
  const categoryShapePhoto = new Map<number, string>();
  (catShapes.data || []).forEach((r: any) => { if (r.ref_photo_url && !categoryShapePhoto.has(r.shape_id)) categoryShapePhoto.set(r.shape_id, r.ref_photo_url); });
  const shapeMap = new Map<string, Option>();
  (shapes || []).forEach((s: any) => addOption(shapeMap, s.name, s.id, categoryShapePhoto.get(s.id) || s.ref_photo_url));
  const colourMap = new Map<string, Option>();
  (colors || []).forEach((c: any) => addOption(colourMap, c.name, c.id, c.ref_photo_url));
  const shapeName = new Map((shapes || []).map((s: any) => [s.id, s.name as string]));
  const colourName = new Map((colors || []).map((c: any) => [c.id, c.name as string]));
  const sizes = (sizeRows.data || []) as { id: number; shape_id: number; size_mm: string }[];
  const sizeById = new Map(sizes.map((z) => [z.id, z]));
  const bucketIds = new Map<string, number[]>();
  sizes.forEach((z) => { const b = sizeBucketOf(z.size_mm); if (b) bucketIds.set(b, [...(bucketIds.get(b) || []), z.id]); });
  const sizeOptions = SIZE_BUCKETS.filter((b) => bucketIds.has(b.slug)).map((b) => ({ slug: b.slug, name: b.label, ids: bucketIds.get(b.slug)! }));

  const pageGradeIds = new Set([...(gradeRows || []).map((g: any) => g.grade_id), ...sources.map((s) => s.grade_id).filter(Boolean) as number[]]);
  const grades = [...pageGradeIds].map((id) => gradeById.get(id)).filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((g: any) => ({ slug: g.code, name: g.name, summary: g.summary, ids: [g.id] }));

  // Size chart: each shape with its sizes, smallest first.
  const sizeChart = [...shapeMap.values()].map((opt) => {
    const list = [...new Set(sizes.filter((z) => opt.ids.includes(z.shape_id)).map((z) => z.size_mm.trim()))]
      .sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b));
    return { shape: opt.name, slug: opt.slug, sizes: list };
  }).filter((r) => r.sizes.length);

  // Photos with their tags (direct columns + junction tables).
  const photos = (photoRows.data || []) as any[];
  const photoIds = photos.map((p) => p.id);
  const [pShapes, pColors, pSizes] = photoIds.length ? await Promise.all([
    supabasePublic.from('photo_shapes').select('photo_id, shape_id').in('photo_id', photoIds),
    supabasePublic.from('photo_colors').select('photo_id, color_id').in('photo_id', photoIds),
    supabasePublic.from('photo_sizes').select('photo_id, shape_size_id').in('photo_id', photoIds)
  ]) : [none, none, none];
  const tagsOf = (rows: any[] | null, key: string) => {
    const m = new Map<number, number[]>();
    (rows || []).forEach((r: any) => m.set(r.photo_id, [...(m.get(r.photo_id) || []), r[key]]));
    return m;
  };
  const ps = tagsOf(pShapes.data, 'shape_id'), pc = tagsOf(pColors.data, 'color_id'), pz = tagsOf(pSizes.data, 'shape_size_id');
  const gradeOfCategory = new Map<number, string | null>();
  sources.forEach((s) => { if (!gradeOfCategory.has(s.category_id) || s.grade_id) gradeOfCategory.set(s.category_id, s.grade_id ? gradeById.get(s.grade_id)?.code ?? null : null); });
  const catName = new Map((catRows.data || []).map((c: any) => [c.id, c.name as string]));
  const pagePhotos: PagePhoto[] = [];
  for (const p of photos) {
    const src = photoUrl(p, 800, 'photo');
    if (!src) continue;
    const sIds = [...new Set([p.shape_id, ...(ps.get(p.id) || [])].filter(Boolean))];
    const cIds = [...new Set([p.color_id, ...(pc.get(p.id) || [])].filter(Boolean))].filter((id) => colourName.has(id));
    const zIds = [...new Set([p.shape_size_id, ...(pz.get(p.id) || [])].filter(Boolean))];
    const shapeNames = sIds.map((id) => shapeName.get(id)).filter(Boolean) as string[];
    const colourNames = cIds.map((id) => colourName.get(id)).filter(Boolean) as string[];
    // A photo narrowed out by a colour restriction on its source is skipped.
    const narrowed = sources.find((s) => s.category_id === p.category_id)?.color_ids;
    if (narrowed && p.color_id && !narrowed.includes(p.color_id)) continue;
    const sizeLabels = zIds.map((id) => sizeById.get(id)?.size_mm).filter(Boolean) as string[];
    pagePhotos.push({
      id: p.id,
      src,
      alt: [colourNames[0], shapeNames[0], catName.get(p.category_id)].filter(Boolean).join(' ') + (sizeLabels[0] ? `, ${sizeLabels[0]}mm` : ''),
      shapes: shapeNames.map(slugOf),
      colours: colourNames.map(slugOf),
      sizes: [...new Set(sizeLabels.map(sizeBucketOf).filter(Boolean) as string[])],
      grade: gradeOfCategory.get(p.category_id) ?? null
    });
  }

  // Website media: hero, gallery, children tiles.
  const content = withDefaults(categorySchema, node.published ?? categoryDefaults(parent?.slug ?? null, node.slug) ?? {});
  const mediaIds = [content.hero?.image, node.hero_media_id, ...(galleryLinks || []).map((l: any) => l.media_id), ...kids.map((k) => k.hero_media_id ?? k.published?.hero?.image)].filter(Boolean);
  const { data: mediaRows } = mediaIds.length ? await supabasePublic.from('site_media').select('id, storage_path, variants, width, height, alt').in('id', mediaIds) : none;
  const media = new Map((mediaRows || []).map((m: any) => [m.id, m as MediaRow]));

  // Child tiles fall back to a stored catalogue cover.
  const coverFor = async (siteCatId: number): Promise<Img | null> => {
    const catId = sources.find((s) => s.site_category_id === siteCatId)?.category_id;
    const cat = (catRows.data || []).find((c: any) => c.id === catId);
    const photo = cat?.thumbnail_photo_id ? photos.find((p) => p.id === cat.thumbnail_photo_id) : null;
    const src = photo ? photoUrl(photo, 600, 'cover') : pagePhotos.find((p) => sources.some((s) => s.site_category_id === siteCatId))?.src;
    return src ? { src, alt: `${cat?.name ?? ''} stones` } : null;
  };
  const children = await Promise.all(kids.map(async (k) => ({
    slug: k.slug, name: k.name, descriptor: k.descriptor, href: `/products/${node.slug}/${k.slug}`,
    image: toImg(media.get(k.hero_media_id) ?? media.get(k.published?.hero?.image), k.name) ?? await coverFor(k.id)
  })));

  return {
    id: node.id,
    slug: node.slug,
    name: node.name,
    descriptor: node.descriptor,
    href: `${base}/${node.slug}`,
    parent: parent ? { slug: parent.slug, name: parent.name, href: `/products/${parent.slug}` } : null,
    filters: { shape: !!node.filters?.shape, size: !!node.filters?.size, colour: !!node.filters?.colour, grade: !!node.filters?.grade },
    content,
    heroImage: toImg(media.get(content.hero?.image) ?? media.get(node.hero_media_id), `${node.name} stones`),
    children,
    siblings: siblings.map((c) => ({ slug: c.slug, name: c.name, href: `${base}/${c.slug}` })),
    shapes: [...shapeMap.values()],
    sizes: sizeOptions,
    colours: [...colourMap.values()],
    grades,
    sizeChart,
    colourCharts: (catRows.data || []).filter((c: any) => c.color_chart_url).map((c: any) => ({ src: c.color_chart_url, name: c.name })),
    photos: pagePhotos,
    gallery: (galleryLinks || []).map((l: any) => toImg(media.get(l.media_id), node.name)).filter(Boolean) as Img[],
    sourceCount: catIds.length
  };
}

export const getCategoryPage = (parentSlug: string | null, slug: string) =>
  unstable_cache(() => load(parentSlug, slug), ['site-category', parentSlug ?? '', slug], { revalidate: 3600, tags: ['site'] })();

/** Every visible category path, for the sitemap and static generation. */
export const getAllCategoryPaths = unstable_cache(async () => {
  const { data } = await supabasePublic.from('site_categories').select('id, parent_id, slug');
  const rows = (data || []) as any[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows.map((r) => (r.parent_id ? byId.get(r.parent_id) ? { parent: byId.get(r.parent_id).slug as string, slug: r.slug as string } : null : { parent: null, slug: r.slug as string }))
    .filter(Boolean) as { parent: string | null; slug: string }[];
}, ['site-category-paths'], { revalidate: 3600, tags: ['site'] });
