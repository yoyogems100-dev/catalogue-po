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
  // Populated server-side (order creation looks this up fresh from the admin-set
  // price/multiplier) -- absent for categories with no pricing set up yet.
  unitPriceInr?: number | null;
};

type Row = { shape: string; size: string; color: string; qty: string; amount?: string };

// Leading number of a size ("4", "4x6", "1.5") so lines run small to large.
function sizeSortKey(sizeMm: string): number {
  const n = parseFloat(sizeMm);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

// One table per category. The category is the heading above it rather than a
// column, and shapes print as their short code (HS, OS...), so a line fits a
// phone screen instead of wrapping.
function formatTable(rows: Row[]) {
  const hasAmount = rows.some((r) => r.amount !== undefined);
  const w = (key: 'shape' | 'size' | 'color' | 'qty', label: string) =>
    Math.max(label.length, ...rows.map((r) => r[key].length));
  const shapeW = w('shape', 'Shape');
  const sizeW = w('size', 'Size');
  const colorW = w('color', 'Color');
  const qtyW = w('qty', 'Qty');
  const amtW = hasAmount ? Math.max('Amount'.length, ...rows.map((r) => (r.amount || '').length)) : 0;

  const pad = (s: string, n: number, end = true) => (end ? s.padEnd(n) : s.padStart(n));
  const line = (shape: string, size: string, color: string, qty: string, amount: string) =>
    `${pad(shape, shapeW)} ${pad(size, sizeW)} ${pad(color, colorW)} ${pad(qty, qtyW, false)}${hasAmount ? ` ${pad(amount, amtW, false)}` : ''}`.trimEnd();

  return ['```', line('Shape', 'Size', 'Color', 'Qty', 'Amount'), ...rows.map((r) => line(r.shape, r.size, r.color, r.qty, r.amount || '--')), '```'].join('\n');
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
        shape: [item.shapeCode?.trim() || item.shapeName, specText(item.orderSpecs, item.qty)].filter(Boolean).join(' / '),
        size: item.sizeMm,
        color: item.colorName,
        qty: item.qtyUnit ? `${item.qty} ${item.qtyUnit}` : String(item.qty),
        amount: item.unitPriceInr != null ? Math.round(item.unitPriceInr * item.qty).toLocaleString('en-IN') : undefined
      }));
    return ['', `*${category}*`, formatTable(rows)];
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
