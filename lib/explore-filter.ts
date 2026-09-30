import { groupSizes } from './size-options';

/** One photo filter: a shape, a size (grouped by its displayed mm, the same
 *  key the Explore Photos size dropdown uses), a colour/material and a
 *  specification. Each is optional -- null means "all". */
export type ExploreFilter = {
  shapeId: number | null;
  sizeKey: string | null;
  colorId: number | null;
  tagId: number | null;
};

export const NO_FILTER: ExploreFilter = { shapeId: null, sizeKey: null, colorId: null, tagId: null };

export function isFilterEmpty(f: ExploreFilter) {
  return f.shapeId === null && f.sizeKey === null && f.colorId === null && f.tagId === null;
}

const posInt = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null);

/** Reads the stored categories.explore_default_filter JSON (snake_case). */
export function parseExploreFilter(raw: unknown): ExploreFilter {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NO_FILTER;
  const r = raw as Record<string, unknown>;
  return {
    shapeId: posInt(r.shape_id),
    sizeKey: typeof r.size_key === 'string' && r.size_key.trim() ? r.size_key.trim().slice(0, 40) : null,
    colorId: posInt(r.color_id),
    tagId: posInt(r.tag_id)
  };
}

export function toStoredFilter(f: ExploreFilter) {
  return isFilterEmpty(f) ? null : { shape_id: f.shapeId, size_key: f.sizeKey, color_id: f.colorId, tag_id: f.tagId };
}

type FilterablePhoto = { shapeIds: number[]; sizeIds: number[]; colorIds: number[]; tagIds: number[] };
type SizeRow = { id: number; shape_id: number; size_mm: string };

/** Sizes offered once a shape is chosen, grouped by displayed mm. */
export function sizeGroupsFor(sizes: SizeRow[], shapeId: number | null) {
  return groupSizes(shapeId === null ? sizes : sizes.filter((s) => s.shape_id === shapeId));
}

export function matchesFilter(photo: FilterablePhoto, f: ExploreFilter, sizes: SizeRow[]) {
  if (f.shapeId !== null && !photo.shapeIds.includes(f.shapeId)) return false;
  if (f.colorId !== null && !photo.colorIds.includes(f.colorId)) return false;
  if (f.tagId !== null && !photo.tagIds.includes(f.tagId)) return false;
  if (f.sizeKey !== null) {
    const ids = sizeGroupsFor(sizes, f.shapeId).find((g) => g.key === f.sizeKey)?.ids || [];
    if (!ids.some((id) => photo.sizeIds.includes(id))) return false;
  }
  return true;
}

/** Drops any part of a saved filter this category no longer offers, so a
 *  shape unlinked since the default was saved can't leave customers looking
 *  at an empty page with no visible reason. */
export function reconcileFilter(
  f: ExploreFilter,
  options: { shapeIds: number[]; colorIds: number[]; tagIds: number[]; sizes: SizeRow[] }
): ExploreFilter {
  const shapeId = f.shapeId !== null && options.shapeIds.includes(f.shapeId) ? f.shapeId : null;
  const sizeKey = f.sizeKey !== null && sizeGroupsFor(options.sizes, shapeId).some((g) => g.key === f.sizeKey) ? f.sizeKey : null;
  return {
    shapeId,
    sizeKey,
    colorId: f.colorId !== null && options.colorIds.includes(f.colorId) ? f.colorId : null,
    tagId: f.tagId !== null && options.tagIds.includes(f.tagId) ? f.tagId : null
  };
}
