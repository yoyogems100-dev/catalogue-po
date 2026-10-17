// The size table on the order form: after colour and shape, every size of
// the picked shape(s) is a row with its own quantity box. A buyer copying a
// list ("Pear 4x6 1000, 5x7 2000, 6x8 500 ...") types the numbers straight
// in instead of ticking sizes and then typing each one (owner, 2026-10-17).
import { sortSizes, type QuickSize } from './quick-order';

/** What was typed against each size id. */
export type TableEntries = Record<number, string>;
export type TableGroup<S extends QuickSize> = { shapeId: number; sizes: S[] };
export type TableLine<S extends QuickSize> = { shapeId: number; size: S; qty: number };

const WHOLE = /^\d*$/;

/** The picked shapes in pick order, each with its sizes smallest first. `fits` drops sizes the picked colours don't come in. */
export function tableGroups<S extends QuickSize>(shapeIds: number[], sizes: S[], fits: (size: S) => boolean = () => true): TableGroup<S>[] {
  return shapeIds
    .map((shapeId) => ({ shapeId, sizes: sortSizes(sizes.filter((s) => s.shape_id === shapeId && fits(s))) }))
    .filter((g) => g.sizes.length > 0);
}

export function tableSizeCount<S extends QuickSize>(groups: TableGroup<S>[]): number {
  return groups.reduce((n, g) => n + g.sizes.length, 0);
}

/** Rows with a whole quantity above zero, in table order. Empty rows are skipped. */
export function tableLines<S extends QuickSize>(groups: TableGroup<S>[], entries: TableEntries): TableLine<S>[] {
  const lines: TableLine<S>[] = [];
  for (const g of groups) {
    for (const size of g.sizes) {
      const raw = (entries[size.id] || '').trim();
      if (!raw || !WHOLE.test(raw)) continue;
      const qty = Number(raw);
      if (Number.isSafeInteger(qty) && qty > 0 && qty <= 2147483647) lines.push({ shapeId: g.shapeId, size, qty });
    }
  }
  return lines;
}

/** A visible row holding something that isn't a whole number. */
export function tableHasError<S extends QuickSize>(groups: TableGroup<S>[], entries: TableEntries): boolean {
  return groups.some((g) => g.sizes.some((s) => !WHOLE.test((entries[s.id] || '').trim())));
}
