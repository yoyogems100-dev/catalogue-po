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

type Row = { shape: string; size: string; color: string; qty: string; amount?: string; note?: string | null };

// Leading number of a size ("4", "4x6", "1.5") so lines run small to large.
function sizeSortKey(sizeMm: string): number {
  const n = parseFloat(sizeMm);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

// About this many characters fit one line of a WhatsApp bubble on a phone.
const PHONE_LINE = 34;

// One line per item, fields in a fixed order under a key line, with no column
// padding -- a padded table was as wide as its longest shape name, which
// wrapped every row on a phone into two unreadable halves. When any item is
// still long enough to wrap, a blank line separates the items so each one
// reads as a unit.
function formatLines(rows: Row[]) {
  const hasAmount = rows.some((r) => r.amount !== undefined);
  const join = (parts: string[]) => parts.filter(Boolean).join(' · ');
  const key = join(['Shape/Cut', 'Size', 'Color', 'Qty', hasAmount ? 'Amount (₹)' : '']);
  const lines = rows.map((r) => join([r.shape, r.size, r.color, r.qty, hasAmount ? r.amount || '--' : '']) + (r.note ? ` _(${r.note})_` : ''));
  const spaced = lines.some((line) => line.length > PHONE_LINE);
  return [`_${key}_`, ...(spaced ? lines.flatMap((line, i) => (i ? ['', line] : [line])) : lines)].join('\n');
}

function categorySections(items: OrderCartItem[]): string[] {
  const byCategory = new Map<string, OrderCartItem[]>();
  for (const item of items) byCategory.set(item.categoryName, [...(byCategory.get(item.categoryName) || []), item]);
  return [...byCategory].flatMap(([category, lines]) => {
    const rows = [...lines]
      .sort((a, b) =>
        a.shapeName.localeCompare(b.shapeName) ||
        sizeSortKey(a.sizeMm) - sizeSortKey(b.sizeMm) ||
        a.sizeMm.localeCompare(b.sizeMm) ||
        a.colorName.localeCompare(b.colorName))
      .map((item) => ({
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
