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
// - their most recent order (owner, 2026-11-23: "based on the past order
//   automatically show ... first the items the last that they placed"): after
//   the saved picks come the stones of their last order and, inside a stone,
//   the shapes, colours and sizes of the latest order that had that stone.
// Only the buyer's own picks and orders count, never the shop-wide defaults,
// so a buyer with neither sees exactly the order they always did.
import { sanitizePreferences, type OrderPreference } from './customer-preferences';
import { sanitizeInterestIds } from './customer-interests';
import { sizeKey } from './size-options';
import { rankOptions } from './hot-selling';

export type UsualInCategory = { shapeIds: number[]; colorIds: number[]; sizeKeys: string[] };
/** One stone's lines from the latest order that had it. */
export type LastOrderPick = UsualInCategory & { categoryId: number };
/** What a buyer's last orders say: the stones of the latest order, and per stone its latest lines. */
export type LastOrder = { categoryIds: number[]; picks: LastOrderPick[] };
export type UsualSource = { preferences: OrderPreference[]; categoryIds: number[]; lastOrder?: LastOrder | null };

export const EMPTY_USUAL: UsualSource = { preferences: [], categoryIds: [] };
export const EMPTY_LAST_ORDER: LastOrder = { categoryIds: [], picks: [] };

type OrderRow = { id: number; created_at: string };
type ItemRow = { order_id: number; category_id: number | null; shape_id: number | null; color_id: number | null; size_mm?: string | null };

/**
 * From a buyer's orders (binned ones already left out) and their lines: the
 * stones of the most recent order with lines, and for each stone the shapes,
 * colours and sizes of the most recent order that had it.
 */
export function lastOrderFrom(orders: OrderRow[], items: ItemRow[]): LastOrder {
  const newest = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const byOrder = new Map<number, ItemRow[]>();
  for (const item of items) {
    if (!item.category_id) continue;
    const list = byOrder.get(item.order_id) || [];
    list.push(item);
    byOrder.set(item.order_id, list);
  }
  const out: LastOrder = { categoryIds: [], picks: [] };
  const push = (list: number[], v: number | null | undefined) => { if (v && !list.includes(v)) list.push(v); };
  // A stone counts from the newest order that had it; older orders don't add to it.
  const taken = new Set<number>();
  for (const order of newest) {
    const lines = byOrder.get(order.id);
    if (!lines) continue;
    if (!out.categoryIds.length) for (const l of lines) push(out.categoryIds, l.category_id);
    const fresh = new Map<number, LastOrderPick>();
    for (const l of lines) {
      const categoryId = l.category_id!;
      if (taken.has(categoryId)) continue;
      let pick = fresh.get(categoryId);
      if (!pick) {
        pick = { categoryId, shapeIds: [], colorIds: [], sizeKeys: [] };
        fresh.set(categoryId, pick);
        out.picks.push(pick);
      }
      push(pick.shapeIds, l.shape_id);
      push(pick.colorIds, l.color_id);
      const key = l.size_mm ? sizeKey(l.size_mm) : '';
      if (key && !pick.sizeKeys.includes(key)) pick.sizeKeys.push(key);
    }
    for (const id of fresh.keys()) taken.add(id);
  }
  return out;
}

/** Sanitizes a last-order value that came over the wire. */
export function cleanLastOrder(raw: unknown): LastOrder {
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((n): n is number => Number.isSafeInteger(n) && n > 0) : []);
  const r = raw as any;
  if (!r || typeof r !== 'object') return EMPTY_LAST_ORDER;
  return {
    categoryIds: ids(r.categoryIds),
    picks: (Array.isArray(r.picks) ? r.picks : []).filter((p: any) => Number.isSafeInteger(p?.categoryId)).map((p: any) => ({
      categoryId: p.categoryId, shapeIds: ids(p.shapeIds), colorIds: ids(p.colorIds),
      sizeKeys: Array.isArray(p.sizeKeys) ? p.sizeKeys.filter((k: unknown): k is string => typeof k === 'string' && k.length <= 24) : []
    }))
  };
}

/** Reads both columns off a customers row; tolerant of missing or malformed values. */
export function usualFromCustomer(row: { order_preferences?: unknown; interest_category_ids?: unknown } | null | undefined): UsualSource {
  if (!row) return EMPTY_USUAL;
  return { preferences: sanitizePreferences(row.order_preferences), categoryIds: sanitizeInterestIds(row.interest_category_ids) };
}

export function hasUsual(source: UsualSource | null | undefined): boolean {
  return !!source && (source.preferences.length > 0 || source.categoryIds.length > 0 || !!source.lastOrder?.categoryIds.length);
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

/** For a native <select>: [usual, last order, rest], each keeping the order it came in. */
export function splitUsual<T extends { id: number }>(options: T[], usualIds: readonly number[] | null | undefined, recentIds: readonly number[] | null | undefined = []): [T[], T[], T[]] {
  const usual = new Set(usualIds || []);
  const recent = new Set(recentIds || []);
  return [
    options.filter((o) => usual.has(o.id)),
    options.filter((o) => !usual.has(o.id) && recent.has(o.id)),
    options.filter((o) => !usual.has(o.id) && !recent.has(o.id))
  ];
}

/** 2 for a saved usual option, 1 for one from the last order, else 0. */
export function leadTier(id: number, usualIds?: readonly number[] | null, recentIds?: readonly number[] | null): number {
  return usualIds?.includes(id) ? 2 : recentIds?.includes(id) ? 1 : 0;
}

/** The shapes, colours and sizes of the latest order that had this stone. */
export function lastOrderInCategory(source: UsualSource | null | undefined, categoryId: number | null | undefined): UsualInCategory {
  const pick = categoryId ? source?.lastOrder?.picks.find((p) => p.categoryId === categoryId) : undefined;
  return pick ? { shapeIds: pick.shapeIds, colorIds: pick.colorIds, sizeKeys: pick.sizeKeys } : { shapeIds: [], colorIds: [], sizeKeys: [] };
}

export type DropdownIds = { categoryIds: number[]; colorIds: number[]; shapeIds: number[]; sizeIdxs: number[] };

/**
 * Everything one order form's dropdowns need: the saved usual ids, and the
 * last-order ids that follow them (`recent`), for the stone list and, for the
 * chosen stone, its colours, shapes and size-group indexes.
 */
export function usualDropdownIds(source: UsualSource | null | undefined, categoryId: number | null | undefined, sizeGroups: { key: string }[]): DropdownIds & { recent: DropdownIds } {
  const here = usualInCategory(source, categoryId);
  const last = lastOrderInCategory(source, categoryId);
  return {
    categoryIds: usualCategoryIds(source), colorIds: here.colorIds, shapeIds: here.shapeIds, sizeIdxs: usualSizeIndexes(sizeGroups, here.sizeKeys),
    recent: { categoryIds: source?.lastOrder?.categoryIds || [], colorIds: last.colorIds, shapeIds: last.shapeIds, sizeIdxs: usualSizeIndexes(sizeGroups, last.sizeKeys) }
  };
}

/**
 * The order an open dropdown lists its options in: options that fit the other
 * picks (when the form says which) before those that don't; inside each, the
 * buyer's saved usual ones first, then their last order's; then hot-selling,
 * then selected, as before.
 */
export function panelOrder<T extends { id: number }>(options: T[], opts: { selected: Set<number>; hot: (o: T) => boolean; fitIds?: number[]; usualIds?: number[]; recentIds?: number[] }): T[] {
  const fit = opts.fitIds ? new Set(opts.fitIds) : null;
  const tier = (o: T) => leadTier(o.id, opts.usualIds, opts.recentIds);
  return rankOptions(options, opts.selected, opts.hot)
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (fit ? Number(fit.has(b.o.id)) - Number(fit.has(a.o.id)) : 0) || tier(b.o) - tier(a.o) || a.i - b.i)
    .map(({ o }) => o);
}
