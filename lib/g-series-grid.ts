/**
 * The Crushed Ice Cut "G-Series" price sheet as one compact grid.
 *
 * The supplier's sheet is laid out as a single table: shapes that cost the
 * same are named together in one size column (Octagon / Oval / Pear, and
 * Square / Heart / Cushion / Round), and a row pairs a size of each family
 * when they cost the same (3x5 and 4x4). This rebuilds that layout from the
 * saved prices rather than from a fixed copy of the sheet, so the PDF always
 * says what the admin Pricing screen says -- and if one shape is ever priced
 * differently it simply gets a column of its own instead of being misquoted.
 */

export type GSeriesGroupIn = { id: number; name: string };
export type GSeriesShapeIn = { id: number; name: string; image?: string | null };
export type GSeriesSizeIn = { id: number; shapeId: number; sizeMm: string };
export type GSeriesPriceIn = { shapeSizeId: number; groupId: number; price: number };

export type GSeriesColumn = { id: number; letter: string; title: string | null };
export type GSeriesFamily = { shapes: { name: string; image: string | null }[] };
export type GSeriesRow = { sizes: string[][]; prices: (number | null)[] };
export type GSeriesGrid = { columns: GSeriesColumn[]; families: GSeriesFamily[]; rows: GSeriesRow[] };

export const G_SERIES_PREFIX = 'G-Series ';

/** "G-Series A · White D" -> { letter: "A", title: "White D" }. */
export function parseGSeriesGroup(name: string): { letter: string; title: string | null } | null {
  const m = name.match(/^G-Series ([A-Z])(?:\s*·\s*(.+))?$/);
  return m ? { letter: m[1], title: m[2]?.trim() || null } : null;
}

/** A round "4.0" is the sheet's "4x4": one key so Round lines up with Square. */
export function sizeKey(sizeMm: string): string {
  const parts = sizeMm.toLowerCase().split('x').map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n))) return sizeMm.trim();
  const [a, b = a] = parts;
  return `${a}x${b}`;
}

const area = (key: string) => key.split('x').map(Number).reduce((x, y) => x * y, 1);
const byArea = (a: string, b: string) => area(a) - area(b) || a.localeCompare(b, undefined, { numeric: true });

// The order the sheet names them in; anything else follows alphabetically.
const SHAPE_ORDER = ['Octagon', 'Oval', 'Pear', 'Square', 'Heart', 'Cushion', 'Round'];
const shapeRank = (name: string) => {
  const i = SHAPE_ORDER.indexOf(name);
  return i === -1 ? SHAPE_ORDER.length : i;
};

export function buildGSeriesGrid(groups: GSeriesGroupIn[], shapes: GSeriesShapeIn[], sizes: GSeriesSizeIn[], prices: GSeriesPriceIn[]): GSeriesGrid {
  const columns = groups
    .map((g) => ({ g, parsed: parseGSeriesGroup(g.name) }))
    .filter((x): x is { g: GSeriesGroupIn; parsed: { letter: string; title: string | null } } => x.parsed !== null)
    .sort((a, b) => a.parsed.letter.localeCompare(b.parsed.letter))
    .map(({ g, parsed }) => ({ id: g.id, ...parsed }));

  const priceAt = new Map(prices.map((p) => [`${p.shapeSizeId}:${p.groupId}`, p.price]));
  const vectorOf = (sizeId: number) => columns.map((c) => priceAt.get(`${sizeId}:${c.id}`) ?? null);
  const vkey = (v: (number | null)[]) => v.map((n) => (n === null ? '-' : n)).join('|');

  // Each priced shape's size -> price vector, and a signature of the whole map.
  type ShapeMap = { shape: GSeriesShapeIn; bySize: Map<string, (number | null)[]>; signature: string };
  const shapeMaps: ShapeMap[] = [];
  for (const shape of shapes) {
    const bySize = new Map<string, (number | null)[]>();
    for (const size of sizes.filter((s) => s.shapeId === shape.id)) {
      const v = vectorOf(size.id);
      if (v.every((n) => n === null)) continue;
      bySize.set(sizeKey(size.sizeMm), v);
    }
    if (!bySize.size) continue;
    const signature = [...bySize.entries()].sort(([a], [b]) => byArea(a, b)).map(([k, v]) => `${k}=${vkey(v)}`).join(';');
    shapeMaps.push({ shape, bySize, signature });
  }

  // Shapes priced identically, size for size, share one size column.
  const familyMaps = new Map<string, ShapeMap[]>();
  for (const m of shapeMaps) familyMaps.set(m.signature, [...(familyMaps.get(m.signature) || []), m]);
  const familyList = [...familyMaps.values()]
    .map((members) => members.sort((a, b) => shapeRank(a.shape.name) - shapeRank(b.shape.name) || a.shape.name.localeCompare(b.shape.name)))
    .sort((a, b) => shapeRank(a[0].shape.name) - shapeRank(b[0].shape.name) || b[0].bySize.size - a[0].bySize.size);

  // One row per distinct price vector, holding each family's sizes at that price.
  const rowsByVector = new Map<string, GSeriesRow>();
  familyList.forEach((members, fi) => {
    for (const [key, v] of members[0].bySize) {
      const k = vkey(v);
      let row = rowsByVector.get(k);
      if (!row) { row = { sizes: familyList.map(() => []), prices: v }; rowsByVector.set(k, row); }
      row.sizes[fi].push(key);
    }
  });
  const rows = [...rowsByVector.values()];
  rows.forEach((r) => r.sizes.forEach((list) => list.sort(byArea)));
  const firstArea = (r: GSeriesRow) => Math.min(...r.sizes.flat().map(area));
  rows.sort((a, b) => {
    for (let i = 0; i < a.prices.length; i++) {
      const x = a.prices[i] ?? Infinity, y = b.prices[i] ?? Infinity;
      if (x !== y) return x - y;
    }
    return firstArea(a) - firstArea(b);
  });

  return {
    columns,
    families: familyList.map((members) => ({ shapes: members.map((m) => ({ name: m.shape.name, image: m.shape.image ?? null })) })),
    rows
  };
}

/** "3x5" -> "3×5" for print. */
export function displaySize(key: string) {
  return key.replace(/x/g, '×');
}
