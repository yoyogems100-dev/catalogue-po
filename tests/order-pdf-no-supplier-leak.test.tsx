import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfItems } from '../lib/pdf/build-pdf-items';

// The owner never reveals supplier or cost price (CP) to a customer -- this
// is the one function that decides what reaches the customer-facing PDF, so
// it's worth a standing regression test rather than just a one-time read of
// the code, given how business-sensitive a leak here would be.
test('the customer PDF never includes supplier, cost price or cost currency', () => {
  const rawItem = {
    category_id: 1,
    shape_id: 2,
    shape_size_id: 3,
    color_id: 4,
    order_specs: null,
    quantity: 10,
    unit_price: 500,
    request_type: 'Place Order',
    // Internal-only fields that exist on the raw order_items row -- must
    // never appear on the mapped PDF item.
    supplier_id: 99,
    cost_price: 350,
    cost_currency: 'RMB'
  };
  const [pdfItem] = buildPdfItems([rawItem], {
    categoryName: { 1: 'Crushed Ice Cut' },
    shapeName: { 2: 'Round' },
    sizeMm: { 3: '4.0' },
    colorName: { 4: 'Aquamarine' }
  });
  assert.equal(pdfItem.categoryName, 'Crushed Ice Cut');
  assert.equal(pdfItem.unitPrice, 500);
  const keys = Object.keys(pdfItem);
  for (const leaked of ['supplierId', 'supplier_id', 'costPrice', 'cost_price', 'costCurrency', 'cost_currency']) {
    assert.equal(keys.includes(leaked), false, `PDF item must not include "${leaked}"`);
  }
});
