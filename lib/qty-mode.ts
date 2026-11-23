// "Same qty for all" or "Different qty each" for the shape x colour x size
// lines one pick makes -- the choice the buyer's order form (POSelector) gives,
// shared with Admin -> Create order.
import { parseQuantity } from './quantity';

export type QtyPlan<C> = {
  /** The lines to add, each with its quantity. Empty when nothing can be added yet. */
  lines: { combo: C; qty: number }[];
  /** A typed quantity that isn't a whole number ("12.5", "abc"). */
  invalid: boolean;
  total: number;
};

/**
 * One quantity for every line, or each line its own: a line's own box starts
 * at the shared quantity, and a line left empty (or 0) is skipped.
 */
export function planQuantities<C extends { key: string }>(combos: C[], perLine: boolean, sameQty: string, lineQty: Record<string, string>): QtyPlan<C> {
  const textFor = (key: string) => (perLine ? lineQty[key] ?? sameQty : sameQty).trim();
  const invalid = combos.some((c) => !/^\d*$/.test(textFor(c.key)));
  const lines = invalid ? [] : combos
    .map((combo) => ({ combo, qty: parseQuantity(textFor(combo.key)) || 0 }))
    .filter((l) => l.qty > 0);
  // With one quantity for all, every line needs it.
  if (!perLine && lines.length !== combos.length) return { lines: [], invalid, total: 0 };
  return { lines, invalid, total: lines.reduce((n, l) => n + l.qty, 0) };
}
