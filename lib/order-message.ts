export type OrderCartItem = {
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  sizeId: number | null;
  sizeMm: string;
  colorId: number;
  colorName: string;
  qty: number;
  requestType: string;
};

function formatTable(rows: { category: string; shape: string; size: string; color: string; qty: string }[]) {
  const w = (key: keyof (typeof rows)[number], label: string) =>
    Math.max(label.length, ...rows.map((r) => r[key].length));
  const catW = w('category', 'Category');
  const shapeW = w('shape', 'Shape');
  const sizeW = w('size', 'Size');
  const colorW = w('color', 'Color');
  const qtyW = w('qty', 'Qty');

  const pad = (s: string, n: number, end = true) => (end ? s.padEnd(n) : s.padStart(n));

  const header = `${pad('Category', catW)}  ${pad('Shape', shapeW)}  ${pad('Size', sizeW)}  ${pad('Color', colorW)}  ${pad('Qty', qtyW, false)}`;
  const divider = `${'-'.repeat(catW)}  ${'-'.repeat(shapeW)}  ${'-'.repeat(sizeW)}  ${'-'.repeat(colorW)}  ${'-'.repeat(qtyW)}`;
  const lines = rows.map(
    (r) => `${pad(r.category, catW)}  ${pad(r.shape, shapeW)}  ${pad(r.size, sizeW)}  ${pad(r.color, colorW)}  ${pad(r.qty, qtyW, false)}`
  );
  return ['```', header, divider, ...lines, '```'].join('\n');
}

// Groups lines by their own requestType instead of assuming one type for the
// whole cart -- a single WhatsApp send can now mix Place Order and Request
// Quotation lines. Place Order is shown first (it's the default and the more
// actionable of the two), Request Quotation second, and a section header is
// only added when both types are actually present.
export function buildOrderMessage(cart: OrderCartItem[], contactName: string, comment: string) {
  const toRow = (item: OrderCartItem) => ({
    category: item.categoryName,
    shape: item.shapeName,
    size: item.sizeMm,
    color: item.colorName,
    qty: String(item.qty)
  });

  const placeOrderItems = cart.filter((i) => i.requestType !== 'Request Quotation');
  const quotationItems = cart.filter((i) => i.requestType === 'Request Quotation');
  const mixed = placeOrderItems.length > 0 && quotationItems.length > 0;

  const uniqueCategories = [...new Set(cart.map((i) => i.categoryName))];
  const title = uniqueCategories.length === 1 ? uniqueCategories[0] : 'YOYO GEMS Requirement';

  const sections: string[] = [];
  if (placeOrderItems.length > 0) {
    if (mixed) sections.push('*PLACE ORDER*');
    sections.push(formatTable(placeOrderItems.map(toRow)));
  }
  if (quotationItems.length > 0) {
    if (mixed) sections.push('*REQUEST QUOTATION*');
    sections.push(formatTable(quotationItems.map(toRow)));
  }

  return [
    'Hello YOYO GEMS,',
    '',
    `*${title}*`,
    mixed ? '' : `Request Type: ${cart[0]?.requestType || 'Place Order'}`,
    contactName ? `Name / Company: ${contactName}` : '',
    '',
    'Requirement:',
    ...sections,
    '',
    comment ? `Additional Comment: ${comment}` : '',
    '',
    'Thank you.'
  ]
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n');
}
