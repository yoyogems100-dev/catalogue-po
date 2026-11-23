// A regular buyer's "usual" options, listed first in every order dropdown
// (owner, 2026-11-23: "if for a user I've already added their go-to
// requirements ... they should first show that, both on admin and po").
//
// Two things the team saves per buyer feed it:
// - customers.interest_category_ids -- the "Go-to requirements" categories on
//   the admin customer page: those stones come first in a stone/category list.
// - customers.order_preferences -- the usual picks ("Red -> Ruby Corundum 5A,
//   Round 3 mm, #12"): their stone comes first too, and inside that stone the
//   picked colour, shape and size come first in those lists.
// Only the buyer's own picks count, never the shop-wide defaults, so a buyer
// with nothing saved sees exactly the order they always did.
import { sanitizePreferences, type OrderPreference } from './customer-preferences';
import { sanitizeInterestIds } from './customer-interests';
import { sizeKey } from './size-options';
import { rankOptions } from './hot-selling';

export type UsualSource = { preferences: OrderPreference[]; categoryIds: number[] };
export type UsualInCategory = { shapeIds: number[]; colorIds: number[]; sizeKeys: string[] };

export const EMPTY_USUAL: UsualSource = { preferences: [], categoryIds: [] };

/** Reads both columns off a customers row; tolerant of missing or malformed values. */
export function usualFromCustomer(row: { order_preferences?: unknown; interest_category_ids?: unknown } | null | undefined): UsualSource {
  if (!row) return EMPTY_USUAL;
  return { preferences: sanitizePreferences(row.order_preferences), categoryIds: sanitizeInterestIds(row.interest_category_ids) };
}

export function hasUsual(source: UsualSource | null | undefined): boolean {
  return !!source && (source.preferences.length > 0 || source.categoryIds.length > 0);
}

/** Go-to categories in the team's order, then any other stone a usual pick opens. */
export function usualCategoryIds(source: UsualSource | null | undefined): number[] {
  if (!source) return [];
  const out = [...source.categoryIds];
  for (const p of source.preferences) if (!out.includes(p.categoryId)) out.push(p.categoryId);
  return out;
}

/** The colours, shapes and sizes the buyer's usual picks name for this stone. */
export function usualInCategory(source: UsualSource | null | undefined, categoryId: number | null | undefined): UsualInCategory {
  const out: UsualInCategory = { shapeIds: [], colorIds: [], sizeKeys: [] };
  if (!source || !categoryId) return out;
  for (const p of source.preferences) {
    if (p.categoryId !== categoryId) continue;
    if (p.shapeId && !out.shapeIds.includes(p.shapeId)) out.shapeIds.push(p.shapeId);
    if (p.colorId && !out.colorIds.includes(p.colorId)) out.colorIds.push(p.colorId);
    const key = p.size ? sizeKey(p.size) : '';
    if (key && !out.sizeKeys.includes(key)) out.sizeKeys.push(key);
  }
  return out;
}

/** Indexes into a grouped size list (lib/faceted-picker sizeGroupsOf) whose size is a usual one. */
export function usualSizeIndexes(groups: { key: string }[], sizeKeys: string[]): number[] {
  if (!sizeKeys.length) return [];
  const wanted = new Set(sizeKeys);
  return groups.flatMap((g, i) => (wanted.has(g.key) ? [i] : []));
}

/** shape_sizes ids whose size is a usual one, for lists keyed by the row itself. */
export function usualSizeIds(sizes: { id: number; sizeMm: string }[], sizeKeys: string[]): number[] {
  if (!sizeKeys.length) return [];
  const wanted = new Set(sizeKeys);
  return sizes.filter((s) => wanted.has(sizeKey(s.sizeMm))).map((s) => s.id);
}

/** Search hits or similar rows: those in a usual category first, each part in its own order. */
export function usualCategoriesFirst<T extends { categoryId: number }>(rows: T[], categoryIds: readonly number[]): T[] {
  if (!categoryIds.length) return rows;
  const usual = new Set(categoryIds);
  return [...rows.filter((r) => usual.has(r.categoryId)), ...rows.filter((r) => !usual.has(r.categoryId))];
}

/** For a native <select>: [usual, rest], each keeping the order it came in. */
export function splitUsual<T extends { id: number }>(options: T[], usualIds: readonly number[] | null | undefined): [T[], T[]] {
  if (!usualIds?.length) return [[], options];
  const usual = new Set(usualIds);
  return [options.filter((o) => usual.has(o.id)), options.filter((o) => !usual.has(o.id))];
}

/**
 * Everything one order form's dropdowns need: the stone list's usual ids, and
 * for the chosen stone the usual colours, shapes and size-group indexes.
 */
export function usualDropdownIds(source: UsualSource | null | undefined, categoryId: number | null | undefined, sizeGroups: { key: string }[]) {
  const here = usualInCategory(source, categoryId);
  return { categoryIds: usualCategoryIds(source), colorIds: here.colorIds, shapeIds: here.shapeIds, sizeIdxs: usualSizeIndexes(sizeGroups, here.sizeKeys) };
}

/**
 * The order an open dropdown lists its options in: options that fit the other
 * picks (when the form says which) before those that don't; inside each, the
 * buyer's usual ones first; then hot-selling, then selected, as before.
 */
export function panelOrder<T extends { id: number }>(options: T[], opts: { selected: Set<number>; hot: (o: T) => boolean; fitIds?: number[]; usualIds?: number[] }): T[] {
  const fit = opts.fitIds ? new Set(opts.fitIds) : null;
  const usual = new Set(opts.usualIds || []);
  return rankOptions(options, opts.selected, opts.hot)
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (fit ? Number(fit.has(b.o.id)) - Number(fit.has(a.o.id)) : 0) || Number(usual.has(b.o.id)) - Number(usual.has(a.o.id)) || a.i - b.i)
    .map(({ o }) => o);
}
