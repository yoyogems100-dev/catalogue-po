import {specText,type OrderSpecs} from './order-specs';
export type OrderCartItem = {
  orderSpecs?: OrderSpecs;
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  /** Admin-set short code (HS, OS...); the full name prints when absent. */
  shapeCode?: string | null;
  sizeId: number | null;
  sizeMm: string;
  colorId: number;
  colorName: string;
  qty: number;
  /** "lines" for Semi Precious Beads; absent means pieces (printed bare). */
  qtyUnit?: string | null;
  requestType: string;
  /** The buyer's note on this line ("Radiant cut required"). */
  note?: string | null;
  // Populated server-side (order creation looks this up fresh from the admin-set
  // price/multiplier) -- absent for categories with no pricing set up yet.
  unitPriceInr?: number | null;
};

type Field = 'shape' | 'size' | 'color';
type Row = Record<Field, string> & { qty: string; amount?: string; note?: string | null };

// Leading number of a size ("4", "4x6", "1.5") so lines run small to large.
function sizeSortKey(sizeMm: string): number {
  const n = parseFloat(sizeMm);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

const compareField = (field: Field, a: string, b: string) =>
  field === 'size' ? sizeSortKey(a) - sizeSortKey(b) || a.localeCompare(b) : a.localeCompare(b);

// Ways to group lines: the two fields written once in a group's heading, and
// the one listed under it -- "Round · White" over its sizes, "Oval · 4x6" over
// its colours, or "4mm · White" over its shapes.
type Cut = { fixed: [Field, Field]; varies: Field; label: string };
const CUTS: Cut[] = [
  { fixed: ['shape', 'color'], varies: 'size', label: 'Sizes' },
  { fixed: ['shape', 'size'], varies: 'color', label: 'Colors' },
  { fixed: ['size', 'color'], varies: 'shape', label: 'Shapes' }
];

const byFields = (fields: Field[]) => (a: Row, b: Row) =>
  fields.reduce((order, f) => order || compareField(f, a[f], b[f]), 0);
const byShapeSizeColor = byFields(['shape', 'size', 'color']);

// Greedy: take the biggest set of still-ungrouped lines that share two fields,
// under whichever cut gives it (ties go to the first cut listed), and repeat
// until only lone lines are left. A cart can mix all three patterns -- fifteen
// sizes of Round White beside five colours of Oval 4x6 -- so one cut for the
// whole category would split whichever pattern it didn't pick.
function groupRows(rows: Row[]) {
  const groups: { cut: Cut | null; rows: Row[] }[] = [];
  let left = rows;
  while (left.length) {
    let best: { cut: Cut; rows: Row[] } | null = null;
    for (const cut of CUTS) {
      const byKey = new Map<string, Row[]>();
      for (const row of left) {
        const key = cut.fixed.map((f) => row[f]).join('\u0000');
        byKey.set(key, [...(byKey.get(key) || []), row]);
      }
      for (const members of byKey.values()) if (members.length > (best?.rows.length || 1)) best = { cut, rows: members };
    }
    if (!best) break;
    const { cut, rows: members } = best;
    groups.push({ cut, rows: [...members].sort(byFields([cut.varies])) });
    left = left.filter((row) => !members.includes(row));
  }
  for (const row of left) groups.push({ cut: null, rows: [row] });
  return groups.sort((a, b) => byShapeSizeColor(a.rows[0], b.rows[0]));
}

const qtyText = (r: Row) => [r.qty, r.amount ? `₹${r.amount}` : ''].filter(Boolean).join(' · ');
const noteText = (r: Row) => (r.note ? ` _(${r.note})_` : '');

// Whatever repeats is written once. A group's shared fields head it and only
// what changes is listed below; when every line in the group also shares a
// quantity, that goes in the heading too ("— 200 each") and the changing
// values fold onto one line. A lone line prints whole, and blank lines only
// separate groups when at least one group spans several lines.
function formatLines(rows: Row[]) {
  const blocks = groupRows(rows).map(({ cut, rows: group }) => {
    const [first] = group;
    if (!cut) return `• ${[first.shape, first.size, first.color].join(' · ')} — ${qtyText(first)}${noteText(first)}`;
    const heading = `• *${cut.fixed.map((f) => first[f]).join(' · ')}*`;
    const uniform = group.every((r) => r.qty === first.qty && !r.note && !r.amount);
    if (uniform) return `${heading} — ${first.qty} each\n   ${cut.label}: ${group.map((r) => r[cut.varies]).join(', ')}`;
    return [heading, ...group.map((r) => `   ${r[cut.varies]} — ${qtyText(r)}${noteText(r)}`)].join('\n');
  });
  return blocks.join(blocks.some((b) => b.includes('\n')) ? '\n\n' : '\n');
}

function categorySections(items: OrderCartItem[]): string[] {
  const byCategory = new Map<string, OrderCartItem[]>();
  for (const item of items) byCategory.set(item.categoryName, [...(byCategory.get(item.categoryName) || []), item]);
  return [...byCategory].flatMap(([category, lines]) => {
    const rows = lines.map((item) => ({
      shape: [item.shapeCode?.trim() || item.shapeName, specText(item.orderSpecs, item.qty)].filter(Boolean).join(' – '),
      size: item.sizeMm,
      color: item.colorName,
      qty: item.qtyUnit ? `${item.qty} ${item.qtyUnit}` : String(item.qty),
      amount: item.unitPriceInr != null ? Math.round(item.unitPriceInr * item.qty).toLocaleString('en-IN') : undefined,
      note: item.note
    }));
    return ['', `*${category}*`, formatLines(rows)];
  });
}

// Groups lines by their own requestType -- a single send can mix Place Order
// and Request Quotation lines. Place Order comes first, and a section header
// is only added when both types are actually present.
export function buildOrderMessage(cart: OrderCartItem[], contactName: string, comment: string) {
  const placeOrderItems = cart.filter((i) => i.requestType !== 'Request Quotation');
  const quotationItems = cart.filter((i) => i.requestType === 'Request Quotation');
  const mixed = placeOrderItems.length > 0 && quotationItems.length > 0;

  const sections: string[] = [];
  if (placeOrderItems.length > 0) {
    if (mixed) sections.push('', '*PURCHASE*');
    sections.push(...categorySections(placeOrderItems));
  }
  if (quotationItems.length > 0) {
    if (mixed) sections.push('', '*REQUEST QUOTATION*');
    sections.push(...categorySections(quotationItems));
  }

  // Only priced lines count toward the total -- a cart mixing priced and
  // unpriced categories still gets an honest (partial) estimate, not a
  // silently wrong "0".
  const pricedItems = cart.filter((i) => i.unitPriceInr != null);
  const grandTotal = pricedItems.reduce((sum, i) => sum + (i.unitPriceInr || 0) * i.qty, 0);
  const totalLine = pricedItems.length > 0
    ? `*Estimated Total: ₹${Math.round(grandTotal).toLocaleString('en-IN')}*${pricedItems.length < cart.length ? ' (priced lines only)' : ''}`
    : '';

  return [
    'Hello YOYO GEMS,',
    contactName ? `Name / Company: ${contactName}` : '',
    !mixed && quotationItems.length > 0 ? 'Request Type: Request Quotation' : '',
    ...sections,
    totalLine,
    '',
    comment ? `Comment: ${comment}` : '',
    '',
    'Thank you.'
  ]
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n');
}
