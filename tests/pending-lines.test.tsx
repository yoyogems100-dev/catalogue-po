import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingByBuyer } from '../lib/pending-lines';
import { balanceOf, hasFulfilmentColumns, lineState, parseSent, sentOf } from '../lib/line-fulfilment';

const names = {
  category: { 3: 'Nano', 12: 'Coloured CZ Stones' }, shape: { 1: 'Pear', 2: 'Oval' }, size: { 10: '4x6', 11: '5x7' },
  color: { 114: 'Blue Nano #114', 30: 'Yellow' }, customer: { 7: { name: 'Discovery Jewels', company: null } },
};
const orders = [
  { id: 2, customer_id: 7, contact_name: null, created_at: '2026-10-14T10:00:00Z', status: 'placed' },
  { id: 1, customer_id: 7, contact_name: null, created_at: '2026-10-10T10:00:00Z', status: 'confirmed' },
  { id: 3, customer_id: null, contact_name: 'Walk-in', created_at: '2026-10-12T10:00:00Z', status: 'placed' },
];
const items = [
  { id: 1, order_id: 2, category_id: 3, shape_id: 1, shape_size_id: 10, color_id: 114, quantity: 1000, sent_qty: 400 },
  { id: 2, order_id: 2, category_id: 3, shape_id: 1, shape_size_id: 11, color_id: 114, quantity: 2000, sent_qty: 2000 },
  { id: 3, order_id: 1, category_id: 12, shape_id: 2, shape_size_id: 10, color_id: 30, quantity: 600, needs_check: true, note: 'Radiant cut' },
  { id: 4, order_id: 3, category_id: 12, shape_id: 2, shape_size_id: 11, color_id: 30, quantity: 50, request_type: 'Request Quotation' },
  { id: 5, order_id: 3, category_id: 12, shape_id: 2, shape_size_id: 11, color_id: 30, quantity: 80 },
  { id: 6, order_id: 99, category_id: 12, shape_id: 2, shape_size_id: 11, color_id: 30, quantity: 80 },
];

test('pending lines: fully sent, quotation and closed-order lines drop out; buyers oldest first', () => {
  const groups = pendingByBuyer(orders, items, names);
  assert.deepEqual(groups.map((g) => [g.name, g.orderIds, g.lines.map((l) => [l.id, l.left]), g.left]), [
    ['Discovery Jewels', [1, 2], [[3, 600], [1, 600]], 1200],
    ['Walk-in', [3], [[5, 80]], 80],
  ]);
  assert.equal(groups[0].lines[0].note, 'Radiant cut');
});

test('pending lines: search and check-only filters', () => {
  assert.deepEqual(pendingByBuyer(orders, items, names, { search: 'nano' }).map((g) => g.lines.map((l) => l.id)), [[1]]);
  assert.deepEqual(pendingByBuyer(orders, items, names, { search: 'walk' }).map((g) => g.name), ['Walk-in']);
  assert.deepEqual(pendingByBuyer(orders, items, names, { checkOnly: true }).map((g) => g.lines.map((l) => l.id)), [[3]]);
});

test('delivery helpers', () => {
  assert.equal(lineState(1000, 0), 'pending');
  assert.equal(lineState(1000, 400), 'part');
  assert.equal(lineState(1000, 1000), 'sent');
  assert.equal(balanceOf(1000, 1200), 0);
  assert.equal(sentOf({}), 0);
  assert.equal(sentOf({ sent_qty: 5 }), 5);
  assert.equal(parseSent('1500', 1000), 1000);
  assert.equal(parseSent(' 300 ', 1000), 300);
  assert.equal(parseSent('-3', 1000), null);
  assert.equal(parseSent('1.5', 1000), null);
  assert.equal(hasFulfilmentColumns({ id: 1 }), false);
  assert.equal(hasFulfilmentColumns({ id: 1, sent_qty: 0 }), true);
});
