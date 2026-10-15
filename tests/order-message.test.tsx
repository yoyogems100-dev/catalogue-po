import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderMessage, type OrderCartItem } from '../lib/order-message';

const line = (shapeName: string, shapeCode: string | null, sizeMm: string, colorName: string, categoryName = 'Crushed Ice Cut', orderSpecs?: any): OrderCartItem => ({
  categoryId: 1, categoryName, shapeId: 1, shapeName, shapeCode, sizeId: 1, sizeMm, colorId: 1, colorName, qty: 200, requestType: 'Place Order', orderSpecs
});

test('WhatsApp message: category once on top, one line per item, shape short codes', () => {
  const message = buildOrderMessage([
    line('Oval', 'OS', '3x5', 'G-20 D-Green'),
    line('Heart', 'HS', '4x4', 'G-34 Aqua'),
    line('Heart', 'HS', '4x4', 'G-20 D-Green'),
    line('Pear', null, '4x6', 'Red', 'Glass Pearls')
  ], 'YG', '');
  assert.equal(message.split('Crushed Ice Cut').length - 1, 1);
  assert.ok(!message.includes('Category') && !message.includes('Request Type') && !message.includes('```'));
  assert.ok(message.includes('*Crushed Ice Cut*\n_Shape/Cut · Size · Color · Qty_\nHS · 4x4 · G-20 D-Green · 200\nHS · 4x4 · G-34 Aqua · 200\nOS · 3x5 · G-20 D-Green · 200\n'));
  // A shape without a code keeps its full name.
  assert.ok(message.includes('*Glass Pearls*\n_Shape/Cut · Size · Color · Qty_\nPear · 4x6 · Red · 200'));
});

test('items long enough to wrap on a phone get a blank line between them', () => {
  const holes = { kind: 'drilled', holes: 1 };
  const message = buildOrderMessage([
    line('Round Checker', null, '4.00', 'Pink', 'Hole Punched Stones', holes),
    line('Round Checker', null, '5.00', 'Pink', 'Hole Punched Stones', holes)
  ], 'idk', '');
  assert.match(message, /Round Checker – 1 hole · 4\.00 · Pink · 200\n\nRound Checker – 1 hole · 5\.00 · Pink · 200/);
});
