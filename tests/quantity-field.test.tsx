import test from 'node:test';
import assert from 'node:assert/strict';
import { formatQtyTotals, formatWeight, normalizeQuantityField, parseQuantityFields, quantityFieldFor } from '../lib/quantity-field';

test('Semi Precious Beads asks for No. of Lines, starting at 5, until the owner saves otherwise', () => {
  assert.deepEqual(quantityFieldFor({}, 45), { label: 'No. of Lines', defaultQty: 5, unit: 'lines', weightUnit: 'ct' });
  assert.deepEqual(quantityFieldFor({}, 37), { label: null, defaultQty: null, unit: null, weightUnit: null });
  const saved = parseQuantityFields(JSON.stringify({ 45: { label: 'No. of Lines', defaultQty: 10 } }));
  assert.equal(quantityFieldFor(saved, 45).defaultQty, 10);
  // Cleared by the owner: back to the ordinary field, not the built-in one.
  assert.deepEqual(quantityFieldFor(parseQuantityFields('{"45":{"label":"","defaultQty":null}}'), 45), { label: null, defaultQty: null, unit: null, weightUnit: null });
});

test('admin input is checked: whole numbers only, short labels', () => {
  assert.deepEqual(normalizeQuantityField({ label: '  No.  of Lines ', defaultQty: '5', unit: ' Lines ', weightUnit: 'ct' }), { label: 'No. of Lines', defaultQty: 5, unit: 'lines', weightUnit: 'ct' });
  assert.equal(normalizeQuantityField({ label: 'x', defaultQty: 2.5 }), undefined);
  assert.equal(normalizeQuantityField({ label: 'x', defaultQty: 0 }), undefined);
  assert.equal(normalizeQuantityField({ label: 'x'.repeat(40) }), undefined);
  assert.deepEqual(parseQuantityFields('not json'), {});
});

test('quantities read in their own unit and are never added across units', () => {
  assert.equal(formatQtyTotals([{ qty: 8, unit: 'lines' }, { qty: 2000, unit: null }, { qty: 64 }]), '2,064 pcs · 8 lines');
  assert.equal(formatQtyTotals([{ qty: 3, unit: 'lines' }]), '3 lines');
  assert.equal(formatWeight(12.5, 'ct'), '12.5 ct');
  assert.equal(formatWeight(3, 'g'), '3 g');
  assert.equal(formatWeight(null, 'ct'), '');
});
