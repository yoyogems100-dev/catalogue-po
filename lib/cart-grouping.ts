/**
 * Inside one category, lines are headed by whatever the buyer chose as the
 * main thing: pick Oval in 20 materials and Heart in 9, and the requirement
 * reads "Oval" with its 20 lines under it, then "Heart" with its 9. Pick White
 * in six shapes and it reads "White" with the six shapes under it.
 *
 * The heading is the side with fewer distinct values (a tie goes to shape),
 * so the many choices sit under the few they were made for.
 */

export type GroupableLine = { shapeId: number; shapeName: string; colorId: number; colorName: string };
export type LineGroupBy = 'shape' | 'color';
export type LineGroup<T> = { by: LineGroupBy; id: number; name: string; items: T[] };

export function lineGroupBy(lines: GroupableLine[]): LineGroupBy {
  const shapes = new Set(lines.map((l) => l.shapeId)).size;
  const colors = new Set(lines.map((l) => l.colorId)).size;
  return colors < shapes ? 'color' : 'shape';
}

/** Groups in heading-name order; each group keeps its lines' incoming order. */
export function groupLines<T extends GroupableLine>(lines: T[], by: LineGroupBy = lineGroupBy(lines)): LineGroup<T>[] {
  const groups = new Map<number, LineGroup<T>>();
  for (const line of lines) {
    const id = by === 'shape' ? line.shapeId : line.colorId;
    const name = by === 'shape' ? line.shapeName : line.colorName;
    const group = groups.get(id) || { by, id, name, items: [] };
    group.items.push(line);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
