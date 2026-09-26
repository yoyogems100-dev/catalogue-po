import { unstable_cache } from 'next/cache';
import { supabasePublic } from '@/lib/supabase-public';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { slugOf } from './filters';
import { byMm } from './chart-pages';

// Data for the Charts pages, read from the live catalogue through the
// website's category tree (so a hidden website category drops out of the
// charts too). Cached like the category pages and refreshed on admin edits.

type SiteNode = { id: number; parentId: number | null; slug: string; name: string; href: string; order: number; catIds: number[] };

/** Visible website categories with the catalogue categories behind each. */
async function loadTree() {
  const [{ data: rows }, { data: sources }] = await Promise.all([
    supabasePublic.from('site_categories').select('id, parent_id, slug, name, sort_order').order('sort_order'),
    supabasePublic.from('site_category_sources').select('site_category_id, category_id, color_ids').order('sort_order')
  ]);
  const all = (rows || []) as any[];
  const byId = new Map(all.map((r) => [r.id, r]));
  const nodes: SiteNode[] = [];
  // Parents first, then their children, in menu order.
  for (const top of all.filter((r) => r.parent_id === null)) {
    for (const r of [top, ...all.filter((c) => c.parent_id === top.id)]) {
      const parent = r.parent_id ? byId.get(r.parent_id) : null;
      nodes.push({
        id: r.id, parentId: r.parent_id, slug: r.slug, name: r.name, order: nodes.length,
        href: parent ? `/products/${parent.slug}/${r.slug}` : `/products/${r.slug}`,
        catIds: (sources || []).filter((s: any) => s.site_category_id === r.id).map((s: any) => s.category_id)
      });
    }
  }
  const colourLimit = new Map<string, number[] | null>();
  (sources || []).forEach((s: any) => colourLimit.set(`${s.site_category_id}:${s.category_id}`, s.color_ids));
  return { nodes, colourLimit };
}

export type ShapeSize = { mm: string; ct: number | null; de: number | null };
export type ChartShape = { slug: string; name: string; img: string | null; sizes: ShapeSize[]; materials: { name: string; href: string }[] };

async function loadShapes(): Promise<ChartShape[]> {
  const { nodes } = await loadTree();
  const tops = nodes.filter((n) => n.parentId === null);
  const topOf = (catId: number) => tops.filter((t) => [t, ...nodes.filter((n) => n.parentId === t.id)].some((n) => n.catIds.includes(catId)));
  const catIds = [...new Set(nodes.flatMap((n) => n.catIds))];
  if (!catIds.length) return [];

  const [catShapes, catSizes] = await Promise.all([
    fetchAllRows<any>((f, t) => supabasePublic.from('category_shapes').select('category_id, shape_id, ref_photo_url', { count: 'exact' }).in('category_id', catIds).range(f, t)),
    fetchAllRows<any>((f, t) => supabasePublic.from('category_shape_sizes').select('category_id, shape_size_id, diamond_equivalent_ct', { count: 'exact' }).in('category_id', catIds).range(f, t))
  ]);
  const shapeIds = [...new Set((catShapes.data || []).map((r: any) => r.shape_id))];
  const sizeIds = [...new Set((catSizes.data || []).map((r: any) => r.shape_size_id))];
  const [{ data: shapes }, sizeRows] = await Promise.all([
    shapeIds.length ? supabasePublic.from('shapes').select('id, name, ref_photo_url, sort_order').in('id', shapeIds).order('sort_order') : Promise.resolve({ data: [] as any[] }),
    sizeIds.length ? fetchAllRows<any>((f, t) => supabasePublic.from('shape_sizes').select('id, shape_id, size_mm, weight_ct', { count: 'exact' }).in('id', sizeIds).range(f, t)) : Promise.resolve({ data: [] as any[] })
  ]);

  const deBySize = new Map<number, number>();
  (catSizes.data || []).forEach((r: any) => { if (r.diamond_equivalent_ct != null) deBySize.set(r.shape_size_id, Number(r.diamond_equivalent_ct)); });
  const categoryPhoto = new Map<number, string>();
  (catShapes.data || []).forEach((r: any) => { if (r.ref_photo_url && !categoryPhoto.has(r.shape_id)) categoryPhoto.set(r.shape_id, r.ref_photo_url); });

  // The same shape name can exist more than once in the master list; merge.
  const out = new Map<string, ChartShape & { ids: number[] }>();
  for (const sh of (shapes || []) as any[]) {
    const slug = slugOf(sh.name);
    if (!slug) continue;
    const entry = out.get(slug) ?? { slug, name: sh.name, img: null, sizes: [], materials: [], ids: [] };
    entry.ids.push(sh.id);
    entry.img ||= sh.ref_photo_url || categoryPhoto.get(sh.id) || null;
    out.set(slug, entry);
  }
  for (const entry of out.values()) {
    const sizes = new Map<string, ShapeSize>();
    for (const z of sizeRows.data || []) {
      if (!entry.ids.includes(z.shape_id)) continue;
      const mm = String(z.size_mm).trim();
      const prev = sizes.get(mm);
      const ct = z.weight_ct != null ? Number(z.weight_ct) : null;
      const de = deBySize.get(z.id) ?? null;
      sizes.set(mm, { mm, ct: prev?.ct ?? ct, de: prev?.de ?? de });
    }
    entry.sizes = [...sizes.values()].sort((a, b) => byMm(a.mm, b.mm));
    const cats = (catShapes.data || []).filter((r: any) => entry.ids.includes(r.shape_id)).map((r: any) => r.category_id);
    const seen = new Set<number>();
    entry.materials = cats.flatMap(topOf).filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ name: t.name, href: `${t.href}?shape=${entry.slug}` }));
  }
  return [...out.values()].map(({ ids: _ids, ...rest }) => rest);
}

export const getChartShapes = unstable_cache(loadShapes, ['site-chart-shapes'], { revalidate: 3600, tags: ['site'] });

export type ColourGroup = { name: string; href: string; colours: { slug: string; name: string; img: string; href: string }[]; unphotographed: string[] };

async function loadColours(siteIds: number[]): Promise<ColourGroup[]> {
  const { nodes, colourLimit } = await loadTree();
  // A ticked main category brings in all of its sub-categories.
  const picked = new Set<number>();
  for (const id of siteIds) {
    if (!nodes.some((n) => n.id === id)) continue;
    picked.add(id);
    nodes.filter((n) => n.parentId === id).forEach((n) => picked.add(n.id));
  }
  const groups = nodes.filter((n) => picked.has(n.id) && n.catIds.length);
  const catIds = [...new Set(groups.flatMap((g) => g.catIds))];
  if (!catIds.length) return [];
  const links = await fetchAllRows<any>((f, t) => supabasePublic.from('category_colors').select('category_id, color_id', { count: 'exact' }).in('category_id', catIds).range(f, t));
  const colorIds = [...new Set((links.data || []).map((r: any) => r.color_id))];
  const { data: colors } = colorIds.length
    ? await supabasePublic.from('colors').select('id, name, ref_photo_url, sort_order').in('id', colorIds).order('sort_order')
    : { data: [] as any[] };

  return groups.map((g) => {
    const allowed = (catId: number, colorId: number) => { const lim = colourLimit.get(`${g.id}:${catId}`); return !lim || lim.includes(colorId); };
    const ids = new Set((links.data || []).filter((r: any) => g.catIds.includes(r.category_id) && allowed(r.category_id, r.color_id)).map((r: any) => r.color_id));
    const seen = new Set<string>();
    const colours: ColourGroup['colours'] = [];
    const unphotographed: string[] = [];
    for (const c of (colors || []) as any[]) {
      const slug = slugOf(c.name);
      if (!ids.has(c.id) || !slug || seen.has(slug)) continue;
      seen.add(slug);
      // Real stone photos only; a colour without one is listed by name.
      if (c.ref_photo_url) colours.push({ slug, name: c.name, img: c.ref_photo_url, href: `${g.href}?colour=${slug}` });
      else unphotographed.push(c.name);
    }
    return { name: g.name, href: g.href, colours, unphotographed };
  }).filter((g) => g.colours.length || g.unphotographed.length);
}

export const getColourChart = (siteIds: number[]) => {
  const ids = [...new Set(siteIds)].sort((a, b) => a - b);
  return unstable_cache(() => loadColours(ids), ['site-chart-colours', ids.join(',')], { revalidate: 3600, tags: ['site'] })();
};

export type ChartGrade = { code: string; name: string; summary: string; description: string; usedIn: { name: string; href: string }[] };

async function loadGrades(): Promise<ChartGrade[]> {
  const [{ nodes }, { data: grades }, { data: pageGrades }, { data: sources }] = await Promise.all([
    loadTree(),
    supabasePublic.from('site_grades').select('id, code, name, summary, description, sort_order').order('sort_order'),
    supabasePublic.from('site_category_grades').select('site_category_id, grade_id'),
    supabasePublic.from('site_category_sources').select('site_category_id, grade_id').not('grade_id', 'is', null)
  ]);
  const uses = [...(pageGrades || []), ...(sources || [])] as { site_category_id: number; grade_id: number }[];
  return ((grades || []) as any[]).map((g) => {
    const siteIds = new Set(uses.filter((u) => u.grade_id === g.id).map((u) => u.site_category_id));
    return {
      code: g.code, name: g.name, summary: g.summary, description: g.description,
      usedIn: nodes.filter((n) => siteIds.has(n.id)).map((n) => ({ name: n.name, href: `${n.href}?grade=${g.code}` }))
    };
  });
}

export const getChartGrades = unstable_cache(loadGrades, ['site-chart-grades'], { revalidate: 3600, tags: ['site'] });
