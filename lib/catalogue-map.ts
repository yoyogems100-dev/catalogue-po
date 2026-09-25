// The whole catalogue's links in one compact shape: which colours, shapes and
// sizes each category carries, and which materials each category sits under.
// Used by the admin Catalogue map (edit links from a colour's or a size's
// side) and by Quick Order's "find by colour & size" (which stones carry this
// colour in this size?). Colours/shapes/sizes are linked to categories only;
// a material carries whatever its categories carry.
import { colorFamilyId } from './color-family';
import { sizeKey } from './size-options';
import { fetchAllRows } from './fetch-all-rows';

export type MapMaterial = { id: number; name: string; sortOrder: number; categoryIds: number[] };
export type MapCategory = { id: number; name: string; slug: string | null; colorIds: number[]; shapeIds: number[]; sizeIds: number[] };
export type MapShape = { id: number; name: string; refPhotoUrl: string | null };
export type MapSize = { id: number; shapeId: number; sizeMm: string };
export type MapColor = { id: number; name: string; hex: string | null; refPhotoUrl: string | null; familyId: number | null };

export type CatalogueMap = {
  materials: MapMaterial[];
  categories: MapCategory[];
  shapes: MapShape[];
  sizes: MapSize[];
  colors: MapColor[];
};

export type MapQuery = {
  /** Exact colour, or any colour in a family. */
  colorId?: number | null;
  familyId?: number | null;
  shapeId?: number | null;
  /** A size as sizeKey() spells it ("6x8", "3"), so 6x8 / 6*8 / 6x8mm match. */
  size?: string | null;
};

/** Categories that carry every part of the query (an empty query matches all). */
export function matchCategories(map: CatalogueMap, q: MapQuery): MapCategory[] {
  const familyColorIds = q.familyId && !q.colorId
    ? new Set(map.colors.filter((c) => c.familyId === q.familyId).map((c) => c.id))
    : null;
  const sizeById = new Map(map.sizes.map((s) => [s.id, s]));
  return map.categories.filter((cat) => {
    if (q.colorId && !cat.colorIds.includes(q.colorId)) return false;
    if (familyColorIds && !cat.colorIds.some((id) => familyColorIds.has(id))) return false;
    if (q.shapeId && !cat.shapeIds.includes(q.shapeId)) return false;
    if (q.size) {
      const hit = cat.sizeIds.some((id) => {
        const s = sizeById.get(id);
        return !!s && (!q.shapeId || s.shapeId === q.shapeId) && sizeKey(s.sizeMm) === q.size;
      });
      if (!hit) return false;
    }
    return true;
  });
}

export type MaterialGroup = { material: MapMaterial | null; categories: MapCategory[] };

/**
 * Categories grouped under their materials, in the owner's material order. A
 * category under two materials shows in both; one under none goes in a last
 * "Other" group (material: null). Empty groups are dropped.
 */
export function groupByMaterial(map: CatalogueMap, categories: MapCategory[]): MaterialGroup[] {
  const wanted = new Set(categories.map((c) => c.id));
  const order = new Map(map.categories.map((c, i) => [c.id, i]));
  const byId = new Map(map.categories.map((c) => [c.id, c]));
  const placed = new Set<number>();
  const groups: MaterialGroup[] = [];
  for (const material of [...map.materials].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
    const cats = material.categoryIds
      .filter((id) => wanted.has(id))
      .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      .map((id) => byId.get(id)!)
      .filter(Boolean);
    cats.forEach((c) => placed.add(c.id));
    if (cats.length) groups.push({ material, categories: cats });
  }
  const rest = categories.filter((c) => !placed.has(c.id));
  if (rest.length) groups.push({ material: null, categories: rest });
  return groups;
}

/** Distinct sizes (by sizeKey) for a shape across the given categories, smallest first. */
export function sizesFor(map: CatalogueMap, categories: MapCategory[], shapeId: number | null): { key: string; label: string }[] {
  const sizeById = new Map(map.sizes.map((s) => [s.id, s]));
  const keys = new Set<string>();
  for (const cat of categories) {
    for (const id of cat.sizeIds) {
      const s = sizeById.get(id);
      if (s && (!shapeId || s.shapeId === shapeId)) keys.add(sizeKey(s.sizeMm));
    }
  }
  return [...keys].sort(compareSizeKeys).map((key) => ({ key, label: `${key} mm` }));
}

export function compareSizeKeys(a: string, b: string): number {
  const left = a.split('x').map(Number), right = b.split('x').map(Number);
  if (left.every(Number.isFinite) && right.every(Number.isFinite)) {
    for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i] - right[i];
    return left.length - right.length;
  }
  return a.localeCompare(b, 'en', { numeric: true });
}

/**
 * Reads the map with whichever Supabase client the caller has. Every join
 * table is read in full, so each pages past the 1000-row response cap. The
 * materials tables are optional: before their migration runs, the map simply
 * has no materials.
 */
export async function loadCatalogueMap(db: any): Promise<CatalogueMap> {
  const all = <T,>(table: string, columns: string) =>
    fetchAllRows<T>((from, to) => db.from(table).select(columns, { count: 'exact' }).range(from, to));
  const [
    { data: categories }, { data: shapes }, { data: colors }, { data: sizes },
    { data: catColors }, { data: catShapes }, { data: catSizes },
    materialsRes, materialLinksRes
  ] = await Promise.all([
    db.from('categories').select('id, name, slug').order('num'),
    db.from('shapes').select('id, name, ref_photo_url').order('sort_order').order('name'),
    db.from('colors').select('id, name, hex_value, ref_photo_url').order('sort_order').order('name'),
    all<{ id: number; shape_id: number; size_mm: string }>('shape_sizes', 'id, shape_id, size_mm'),
    all<{ category_id: number; color_id: number }>('category_colors', 'category_id, color_id'),
    all<{ category_id: number; shape_id: number }>('category_shapes', 'category_id, shape_id'),
    all<{ category_id: number; shape_size_id: number }>('category_shape_sizes', 'category_id, shape_size_id'),
    db.from('materials').select('id, name, sort_order').order('sort_order').order('name'),
    all<{ material_id: number; category_id: number }>('material_categories', 'material_id, category_id').catch(() => ({ data: [] }))
  ]);

  const push = (map: Map<number, number[]>, key: number, value: number) => {
    const list = map.get(key);
    if (list) list.push(value); else map.set(key, [value]);
  };
  const colorsOf = new Map<number, number[]>();
  const shapesOf = new Map<number, number[]>();
  const sizesOf = new Map<number, number[]>();
  const categoriesOf = new Map<number, number[]>();
  (catColors || []).forEach((r) => push(colorsOf, r.category_id, r.color_id));
  (catShapes || []).forEach((r) => push(shapesOf, r.category_id, r.shape_id));
  (catSizes || []).forEach((r) => push(sizesOf, r.category_id, r.shape_size_id));
  (materialLinksRes?.data || []).forEach((r: { material_id: number; category_id: number }) => push(categoriesOf, r.material_id, r.category_id));

  return {
    materials: (materialsRes?.error ? [] : materialsRes?.data || []).map((m: any) => ({
      id: m.id, name: m.name, sortOrder: m.sort_order ?? 0, categoryIds: categoriesOf.get(m.id) || []
    })),
    categories: (categories || []).map((c: any) => ({
      id: c.id, name: c.name, slug: c.slug,
      colorIds: colorsOf.get(c.id) || [], shapeIds: shapesOf.get(c.id) || [], sizeIds: sizesOf.get(c.id) || []
    })),
    shapes: (shapes || []).map((s: any) => ({ id: s.id, name: s.name, refPhotoUrl: s.ref_photo_url || null })),
    sizes: (sizes || []).map((s) => ({ id: s.id, shapeId: s.shape_id, sizeMm: s.size_mm })),
    colors: (colors || []).map((c: any) => ({
      id: c.id, name: c.name, hex: c.hex_value || null, refPhotoUrl: c.ref_photo_url || null, familyId: colorFamilyId(c.name, c.hex_value)
    }))
  };
}
