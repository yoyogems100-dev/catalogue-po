/**
 * Which price columns a category actually needs, and what to call them.
 *
 * Prices are stored per colour GROUP because the supplier sheets are laid out
 * that way, but almost no category here prices by colour. Deriving the columns
 * straight from the groups produced two bad results the owner ran into:
 *
 *  - Ruby Synthetic's two colours are in no group, so it got NO price column
 *    at all -- a size list with nowhere to type a price.
 *  - Nano has 55 colours, exactly one of which happens to sit in a group named
 *    "Swiss Heavy Round" -- a group made for a different category, reaching
 *    Nano only because the colour "Colorless / White" is shared by twenty
 *    categories. Groups carry a category_id now; pass only the ones in scope.
 *
 * So: a column per group that really covers some of this category's colours,
 * plus one catch-all column for the colours no group covers. And when that
 * leaves a single column there is nothing to tell apart, so it is just
 * "Price" -- naming it after a colour group only invites the reader to think
 * some other column exists.
 */

export type PriceColumn = {
  groupId: number;
  label: string;
  /** The category's colours priced by this column, for the PDF's legend. */
  colors: string[];
};

export const CATCH_ALL_LABEL = 'All other colors';
export const SINGLE_COLUMN_LABEL = 'Price';

export type PriceGroupRow = { id: number; name: string; is_catch_all?: boolean | null; category_id?: number | null };

/** The groups a category may price under: its own, plus any still global. */
export function groupsInScope(groups: PriceGroupRow[], categoryId: number): PriceGroupRow[] {
  return groups.filter((g) => g.is_catch_all || g.category_id == null || g.category_id === categoryId);
}

export function priceColumns(
  groups: PriceGroupRow[],
  categoryColors: { id: number; name: string }[],
  membership: { group_id: number; color_id: number }[]
): PriceColumn[] {
  const catchAll = groups.find((g) => g.is_catch_all);
  const colorName = new Map(categoryColors.map((c) => [c.id, c.name]));

  const namesByGroup = new Map<number, string[]>();
  const grouped = new Set<number>();
  for (const m of membership) {
    const name = colorName.get(m.color_id);
    if (!name) continue;                       // a colour this category doesn't use
    grouped.add(m.color_id);
    namesByGroup.set(m.group_id, [...(namesByGroup.get(m.group_id) || []), name]);
  }

  const sortNames = (a: string[]) => [...a].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));

  const columns: PriceColumn[] = groups
    .filter((g) => !g.is_catch_all && namesByGroup.has(g.id))
    .map((g) => ({ groupId: g.id, label: g.name, colors: sortNames(namesByGroup.get(g.id) || []) }));

  const ungrouped = categoryColors.filter((c) => !grouped.has(c.id)).map((c) => c.name);
  if (catchAll && (ungrouped.length > 0 || columns.length === 0)) {
    columns.push({ groupId: catchAll.id, label: CATCH_ALL_LABEL, colors: sortNames(ungrouped) });
  }

  if (columns.length === 1) columns[0] = { ...columns[0], label: SINGLE_COLUMN_LABEL };
  return columns;
}

/**
 * A shape heading is worth printing only when there is more than one shape to
 * tell apart. Most categories here are round-only; heading their single table
 * "Round" says nothing the reader didn't already know.
 */
export function showShapeHeadings(shapeCount: number) {
  return shapeCount > 1;
}
