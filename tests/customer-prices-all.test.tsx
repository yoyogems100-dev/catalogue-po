import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesFromJson } from '../lib/g-series-entries';
import { priceListFileName } from '../lib/price-list-options';

test('saved customer prices read back; junk entries are dropped', () => {
  assert.deepEqual(entriesFromJson([{ s: 10, g: 5, p: 110 }, { s: 'x', g: 5, p: 1 }, null, { s: 11, g: 5 }]), [{ shapeSizeId: 10, groupId: 5, price: 110 }]);
  assert.deepEqual(entriesFromJson('nope'), []);
});

test('plain price list file names carry the customer and date', () => {
  assert.equal(priceListFileName('price-list-nano', { customerName: 'Discovery Jewels', date: '2026-10-17' }), 'price-list-nano-Discovery-Jewels-2026-10-17.pdf');
  assert.equal(priceListFileName('price-list-nano', { customerName: null, date: '2026-10-17' }), 'price-list-nano-2026-10-17.pdf');
});
