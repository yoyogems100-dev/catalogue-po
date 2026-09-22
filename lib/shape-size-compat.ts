/**
 * Shapes that share no size with the shapes already picked.
 *
 * A line covers one size across every shape on it, so picking Cushion and
 * Baguette together is only meaningful if some millimetre size exists for
 * both. Without this the size picker simply goes dead -- "No common size for
 * these shapes" -- and nothing says which pick caused it or which to undo.
 *
 * Sizes are compared by their millimetre label, not by row id: 6x6 mm is the
 * same size to a buyer whether it is Cushion's row or Octagon's.
 *
 * Returns [] when the current picks already share nothing. Greying out the
 * rest of the list at that point would trap someone in a selection they can
 * no longer edit their way out of.
 */
export function incompatibleShapeIds(
  shapes: { id: number }[],
  sizes: { shapeId: number; sizeMm: string }[],
  picked: number[]
): number[] {
  if (picked.length === 0) return [];

  const byShape = new Map<number, Set<string>>();
  for (const s of sizes) {
    const key = s.sizeMm.trim().toLowerCase();
    if (!byShape.has(s.shapeId)) byShape.set(s.shapeId, new Set());
    byShape.get(s.shapeId)!.add(key);
  }

  let shared: Set<string> | null = null;
  for (const id of picked) {
    const own = byShape.get(id) || new Set<string>();
    shared = shared === null ? new Set(own) : new Set([...shared].filter((mm) => own.has(mm)));
  }
  if (!shared || shared.size === 0) return [];

  return shapes
    .filter((s) => !picked.includes(s.id))
    .filter((s) => {
      const own = byShape.get(s.id);
      if (!own) return true;
      return ![...shared!].some((mm) => own.has(mm));
    })
    .map((s) => s.id);
}

/** Shown on the row itself, so the constraint survives a touchscreen. */
export const NO_SHARED_SIZE_NOTE = 'no shared size';
export const NO_SHARED_SIZE_REASON = 'No size in common with the shapes already selected';
