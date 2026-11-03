// Quick Order without a stone (owner, 2026-11-03): "White, Round, 3 mm,
// 5000 pcs" is clear enough to the buyer and the team, so the stone is
// optional. Before one is chosen, colours are colour families, and shapes and
// sizes come from every stone that carries the chosen colours -- read off the
// catalogue map. A line keeps a real shape and shape_sizes row, and a real
// colour standing for its family, so it stores and prints like any other.
import { compareSizeKeys, type CatalogueMap, type MapCategory, type MapColor } from './catalogue-map';
import { sizeKey } from './size-options';

/** Stones carrying any of the families (all stones when none is chosen). */
export function stonesForFamilies(map: CatalogueMap, familyIds: number[]): MapCategory[] {
  if (!familyIds.length) return map.categories;
  const wanted = new Set(map.colors.filter((c) => c.familyId != null && familyIds.includes(c.familyId)).map((c) => c.id));
  return map.categories.filter((cat) => cat.colorIds.some((id) => wanted.has(id)));
}

/** Stones carrying the families and at least one of the shapes. */
export function stonesForPicks(map: CatalogueMap, familyIds: number[], shapeIds: number[]): MapCategory[] {
  const byColor = stonesForFamilies(map, familyIds);
  return shapeIds.length ? byColor.filter((cat) => shapeIds.some((id) => cat.shapeIds.includes(id))) : byColor;
}

/** Shapes any of the stones carries, in the catalogue's shape order. */
export function shapesOf(map: CatalogueMap, stones: MapCategory[]) {
  const carried = new Set(stones.flatMap((c) => c.shapeIds));
  return map.shapes.filter((s) => carried.has(s.id));
}

/** Distinct sizes (sizeKey) the stones carry for the shapes (any shape when none), smallest first. */
export function sizeKeysOf(map: CatalogueMap, stones: MapCategory[], shapeIds: number[]): string[] {
  const sizeById = new Map(map.sizes.map((s) => [s.id, s]));
  const keys = new Set<string>();
  for (const cat of stones) {
    for (const id of cat.sizeIds) {
      const s = sizeById.get(id);
      if (s && (!shapeIds.length || shapeIds.includes(s.shapeId))) keys.add(sizeKey(s.sizeMm));
    }
  }
  return [...keys].sort(compareSizeKeys);
}

/**
 * The shape_sizes row for a shape in a size that one of the stones carries.
 * Null when none of them has the shape in that size (no red Round 3 mm).
 */
export function sizeRowFor(map: CatalogueMap, stones: MapCategory[], shapeId: number, key: string) {
  const carried = new Set(stones.filter((c) => c.shapeIds.includes(shapeId)).flatMap((c) => c.sizeIds));
  return map.sizes.find((s) => s.shapeId === shapeId && sizeKey(s.sizeMm) === key && carried.has(s.id)) || null;
}

/**
 * The colour that stands for a family on a stone-less line: one named like the
 * family ("White"), else the one most stones carry.
 */
export function familyColor(map: CatalogueMap, familyId: number, familyName: string): MapColor | null {
  const inFamily = map.colors.filter((c) => c.familyId === familyId);
  if (!inFamily.length) return null;
  const named = inFamily.find((c) => c.name.trim().toLowerCase() === familyName.trim().toLowerCase());
  if (named) return named;
  const count = (id: number) => map.categories.filter((cat) => cat.colorIds.includes(id)).length;
  return [...inFamily].sort((a, b) => count(b.id) - count(a.id))[0];
}

export type AnyLine = {
  shapeId: number; shapeName: string; shapeIconKey: string | null;
  sizeId: number; sizeMm: string;
  colorId: number; colorName: string; colorHex: string | null; colorRefPhotoUrl: string | null;
};

/** One line per family x shape x size the catalogue has; combinations that don't exist are skipped. */
export function anyLines(
  map: CatalogueMap,
  families: { id: number; name: string }[],
  shapeIds: number[],
  sizeKeys: string[]
): AnyLine[] {
  const lines: AnyLine[] = [];
  for (const family of families) {
    const color = familyColor(map, family.id, family.name);
    if (!color) continue;
    const stones = stonesForFamilies(map, [family.id]);
    for (const shapeId of shapeIds) {
      const shape = map.shapes.find((s) => s.id === shapeId);
      if (!shape) continue;
      for (const key of sizeKeys) {
        const row = sizeRowFor(map, stones, shapeId, key);
        if (!row) continue;
        lines.push({
          shapeId, shapeName: shape.name, shapeIconKey: shape.iconKey ?? null,
          sizeId: row.id, sizeMm: row.sizeMm,
          colorId: color.id, colorName: family.name, colorHex: color.hex, colorRefPhotoUrl: color.refPhotoUrl
        });
      }
    }
  }
  return lines;
}
