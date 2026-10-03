import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderMessage, type OrderCartItem } from '../lib/order-message';

const line = (shapeName: string, shapeCode: string | null, sizeMm: string, colorName: string, categoryName = 'Crushed Ice Cut'): OrderCartItem => ({
  categoryId: 1, categoryName, shapeId: 1, shapeName, shapeCode, sizeId: 1, sizeMm, colorId: 1, colorName, qty: 200, requestType: 'Place Order'
});

test('WhatsApp message: category once on top, shape short codes, no category column', () => {
  const message = buildOrderMessage([
    line('Oval', 'OS', '3x5', 'G-20 D-Green'),
    line('Heart', 'HS', '4x4', 'G-34 D-Aquamarine'),
    line('Heart', 'HS', '4x4', 'G-20 D-Green'),
    line('Pear', null, '4x6', 'Red', 'Glass Pearls')
  ], 'YG', '');
  assert.equal(message.split('Crushed Ice Cut').length - 1, 1);
  assert.ok(!message.includes('Category'));
  assert.ok(!message.includes('Request Type'));
  assert.match(message, /\*Crushed Ice Cut\*\n```\nShape Size Color +Qty\nHS +4x4 +G-20 D-Green +200\nHS +4x4 +G-34 D-Aquamarine +200\nOS +3x5 +G-20 D-Green +200\n```/);
  // A shape without a code keeps its full name.
  assert.match(message, /\*Glass Pearls\*\n```\nShape Size Color Qty\nPear +4x6 +Red +200\n```/);
});
