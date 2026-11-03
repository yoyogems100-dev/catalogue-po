import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderMessage, type OrderCartItem } from '../lib/order-message';

const line = (shapeName: string, shapeCode: string | null, sizeMm: string, colorName: string, categoryName = 'Crushed Ice Cut', orderSpecs?: any): OrderCartItem => ({
  categoryId: 1, categoryName, shapeId: 1, shapeName, shapeCode, sizeId: 1, sizeMm, colorId: 1, colorName, qty: 200, requestType: 'Place Order', orderSpecs
});

test('WhatsApp message: category once on top, repeated shape/size written once, shape short codes', () => {
  const message = buildOrderMessage([
    line('Oval', 'OS', '3x5', 'G-20 D-Green'),
    line('Heart', 'HS', '4x4', 'G-34 Aqua'),
    line('Heart', 'HS', '4x4', 'G-20 D-Green'),
    line('Pear', null, '4x6', 'Red', 'Glass Pearls')
  ], 'YG', '');
  assert.equal(message.split('Crushed Ice Cut').length - 1, 1);
  assert.ok(!message.includes('Category') && !message.includes('Request Type') && !message.includes('```'));
  assert.ok(message.includes('*Crushed Ice Cut*\n• *HS · 4x4* — 200 each\n   Colors: G-20 D-Green, G-34 Aqua\n\n• OS · 3x5 · G-20 D-Green — 200\n'));
  // A shape without a code keeps its full name.
  assert.ok(message.includes('*Glass Pearls*\n• Pear · 4x6 · Red — 200'));
});

test('fifteen sizes of one shape and colour print the shape and colour once', () => {
  const sizes = ['1.00', '1.25', '1.50', '2.00', '3.00', '4.00', '5.00', '6.00', '7.00', '8.00', '9.00', '10.00', '11.00', '12.00', '13.00'];
  const message = buildOrderMessage([...sizes].reverse().map((s) => line('Round', null, s, 'White', 'Swiss CZ')), '', '');
  assert.ok(message.includes(`*Swiss CZ*\n• *Round · White* — 200 each\n   Sizes: ${sizes.join(', ')}\n`));
  assert.equal(message.split('Round').length - 1, 1);
});

test('each group picks what repeats: sizes under one colour, colours under one size, shapes under both', () => {
  const holes = { kind: 'drilled', holes: 1 };
  const message = buildOrderMessage([
    { ...line('Round', null, '3.00', 'Red'), qty: 50 },
    { ...line('Round', null, '4.00', 'Red'), note: 'Radiant cut' },
    ...['Pink', 'Aqua', 'Yellow'].map((c) => line('Oval', null, '4x6', c)),
    ...['Heart', 'Square'].map((s) => line(s, null, '6.00', 'Pink', 'Hole Punched Stones', holes))
  ], '', '');
  // Different quantities or a note keep one line per size under the shared heading.
  assert.ok(message.includes('• *Oval · 4x6* — 200 each\n   Colors: Aqua, Pink, Yellow\n\n• *Round · Red*\n   3.00 — 50\n   4.00 — 200 _(Radiant cut)_'));
  assert.ok(message.includes('• *6.00 · Pink* — 200 each\n   Shapes: Heart – 1 hole, Square – 1 hole'));
});

test('lines with nothing in common stay one per line with no blank lines between', () => {
  const message = buildOrderMessage([
    line('Round Checker', null, '5.00', 'Pink', 'Hole Punched Stones', { kind: 'drilled', holes: 1 }),
    line('Pear', null, '4x6', 'Blue', 'Hole Punched Stones', { kind: 'drilled', holes: 1 })
  ], 'idk', '');
  assert.match(message, /• Pear – 1 hole · 4x6 · Blue — 200\n• Round Checker – 1 hole · 5\.00 · Pink — 200/);
});
