export type OrderCartItem = {
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  sizeId: number;
  sizeMm: string;
  colorId: number;
  colorName: string;
  qty: number;
};

export function buildOrderMessage(cart: OrderCartItem[], requestType: string, contactName: string, comment: string) {
  const rows = cart.map((item) => ({
    category: item.categoryName,
    shape: item.shapeName,
    size: item.sizeMm,
    color: item.colorName,
    qty: String(item.qty)
  }));

  const uniqueCategories = [...new Set(rows.map((r) => r.category))];
  const title = uniqueCategories.length === 1 ? uniqueCategories[0] : 'YOYO GEMS Requirement';

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

  return [
    'Hello YOYO GEMS,',
    '',
    `*${title}*`,
    `Request Type: ${requestType}`,
    contactName ? `Name / Company: ${contactName}` : '',
    '',
    'Requirement:',
    '```',
    header,
    divider,
    ...lines,
    '```',
    '',
    comment ? `Additional Comment: ${comment}` : '',
    '',
    'Thank you.'
  ]
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n');
}
