import { sizeKey } from './size-options';

/**
 * Shape, size and colour/material can be picked in any order.
 *
 * Each list offers only what goes with the picks already made in the OTHER
 * lists: choose 6x6 first and the shape list narrows to the shapes cut in
 * 6x6 (Cushion, Heart...); choose Tiger Eye first and it narrows to the
 * shapes that come in Tiger Eye. Nothing has to be picked before anything
 * else.
 *
 * A line fans out into shape x size x colour, so a value is offered only if
 * it pairs with EVERY value already picked in each other list -- never a
 * combination that would be silently dropped when the line is added.
 * Because of that, picking something can only narrow the other lists; it can
 * never make an earlier pick invalid.
 */

export type FacetRow = { id: number; shapeId: number; sizeMm: string };
export type SizeGroup<R extends FacetRow = FacetRow> = { key: string; sizeMm: string; rows: R[] };
/** shape_size_id -> colour ids it comes in. null: every colour in every size. */
export type AllowedColors = Map<number, Set<number>> | null;

function sizeNum(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[xX*]\s*\d+(?:\.\d+)?)?(?:\s*mm)?$/i);
  return m ? parseFloat(m[1]) : NaN;
}

/** Every size the category offers, one entry per millimetre size, smallest first. */
export function sizeGroupsOf<R extends FacetRow>(rows: R[]): SizeGroup<R>[] {
  const byKey = new Map<string, SizeGroup<R>>();
  for (const row of rows) {
    const key = sizeKey(row.sizeMm);
    const group = byKey.get(key) || { key, sizeMm: row.sizeMm.trim(), rows: [] };
    group.rows.push(row);
    byKey.set(key, group);
  }
  return [...byKey.values()].sort((a, b) => {
    const na = sizeNum(a.sizeMm);
    const nb = sizeNum(b.sizeMm);
    if (Number.isNaN(na) && Number.isNaN(nb)) return a.sizeMm.localeCompare(b.sizeMm);
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return na - nb || a.sizeMm.localeCompare(b.sizeMm, 'en', { numeric: true });
  });
}

export function allowedColorsOf(pairs?: [number, number][] | null): AllowedColors {
  if (!pairs?.length) return null;
  const map = new Map<number, Set<number>>();
  for (const [sizeId, colorId] of pairs) {
    if (!map.has(sizeId)) map.set(sizeId, new Set());
    map.get(sizeId)!.add(colorId);
  }
  return map;
}

export type FacetPicks = { shapeIds: number[]; sizeIdxs: number[]; colorIds: number[] };

/**
 * What each list can offer given the picks in the other two.
 * `sizeIdxs` index into `groups` (from sizeGroupsOf).
 */
export function facetAvailability<R extends FacetRow>(
  shapeIds: number[],
  colorIds: number[],
  groups: SizeGroup<R>[],
  allowed: AllowedColors,
  picks: FacetPicks
): { shapeIds: Set<number>; sizeIdxs: Set<number>; colorIds: Set<number> } {
  const pickedKeys = new Set(picks.sizeIdxs.map((i) => groups[i]?.key).filter((k): k is string => !!k));
  const rows = groups.flatMap((g) => g.rows.map((row) => ({ row, key: g.key })));
  const carries = (row: R, colorId: number) => !allowed || !!allowed.get(row.id)?.has(colorId);

  const shapeHasKey = new Map<number, Set<string>>();
  for (const { row, key } of rows) {
    if (!shapeHasKey.has(row.shapeId)) shapeHasKey.set(row.shapeId, new Set());
    shapeHasKey.get(row.shapeId)!.add(key);
  }

  // Shape: cut in every picked size, and (when colours depend on size) comes
  // in every picked colour in at least one of those sizes.
  const shapeOk = (shapeId: number) => {
    const own = shapeHasKey.get(shapeId);
    for (const key of pickedKeys) if (!own?.has(key)) return false;
    if (!allowed) return true;
    return picks.colorIds.every((c) =>
      rows.some(({ row, key }) => row.shapeId === shapeId && (!pickedKeys.size || pickedKeys.has(key)) && carries(row, c))
    );
  };

  // Size: every picked shape is cut in it, and every picked colour comes in it.
  const sizeOk = (group: SizeGroup<R>) => {
    for (const shapeId of picks.shapeIds) if (!group.rows.some((r) => r.shapeId === shapeId)) return false;
    if (!allowed) return true;
    return picks.colorIds.every((c) =>
      group.rows.some((r) => (!picks.shapeIds.length || picks.shapeIds.includes(r.shapeId)) && carries(r, c))
    );
  };

  // Colour: offered for every picked shape and every picked size.
  const colorOk = (colorId: number) => {
    if (!allowed) return true;
    const within = rows.filter(({ row, key }) =>
      (!picks.shapeIds.length || picks.shapeIds.includes(row.shapeId)) && (!pickedKeys.size || pickedKeys.has(key)) && carries(row, colorId)
    );
    if (!within.length) return false;
    return picks.shapeIds.every((s) => within.some(({ row }) => row.shapeId === s))
      && [...pickedKeys].every((k) => within.some(({ key }) => key === k));
  };

  return {
    shapeIds: new Set(shapeIds.filter(shapeOk)),
    sizeIdxs: new Set(groups.map((g, i) => (sizeOk(g) ? i : -1)).filter((i) => i >= 0)),
    colorIds: new Set(colorIds.filter(colorOk))
  };
}

/** Size rows the picks point at -- for photo filtering and hot-selling flags. */
export function pickedSizeRows<R extends FacetRow>(groups: SizeGroup<R>[], sizeIdxs: number[], shapeIds: number[]): R[] {
  return sizeIdxs.flatMap((i) => (groups[i]?.rows || []).filter((r) => !shapeIds.length || shapeIds.includes(r.shapeId)));
}

/** Drop picks that no longer fit (e.g. after the category's data changed). */
export function keepAvailable(current: number[], available: Set<number>): number[] {
  return current.every((id) => available.has(id)) ? current : current.filter((id) => available.has(id));
}
