import type { GSeriesGrid } from './g-series-grid';

/** One stored price: a size of one shape, in one colour column. */
export type PriceEntry = { shapeSizeId: number; groupId: number; price: number };

/**
 * Grid prices (one per row and column, as typed on screen) as stored
 * entries: a row prices several shapes' sizes at once, so each cell becomes
 * one entry per size the row covers. An empty cell ("–") stores nothing.
 */
export function gridToEntries(grid: GSeriesGrid, prices: (number | null)[][]): PriceEntry[] {
  const out: PriceEntry[] = [];
  grid.rows.forEach((row, ri) => grid.columns.forEach((col, ci) => {
    const price = prices[ri]?.[ci];
    if (price === null || price === undefined) return;
    for (const shapeSizeId of row.shapeSizeIds) out.push({ shapeSizeId, groupId: col.id, price });
  }));
  return out;
}
