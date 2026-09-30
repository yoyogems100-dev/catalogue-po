import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupLines, lineGroupBy } from '../lib/cart-grouping';

const line = (shapeId: number, shapeName: string, colorId: number, colorName: string) => ({ shapeId, shapeName, colorId, colorName });

test('several materials per shape are headed by shape', () => {
  const lines = [
    ...Array.from({ length: 20 }, (_, i) => line(2, 'Oval', 100 + i, `M${i}`)),
    ...Array.from({ length: 9 }, (_, i) => line(1, 'Heart', 100 + i, `M${i}`))
  ];
  assert.equal(lineGroupBy(lines), 'shape');
  const groups = groupLines(lines);
  assert.deepEqual(groups.map((g) => [g.name, g.items.length]), [['Heart', 9], ['Oval', 20]]);
});

test('one colour in several shapes is headed by colour', () => {
  const lines = [line(1, 'Round', 7, 'White'), line(2, 'Oval', 7, 'White'), line(3, 'Pear', 8, 'Blue')];
  assert.equal(lineGroupBy(lines), 'color');
  assert.deepEqual(groupLines(lines).map((g) => [g.name, g.items.length]), [['Blue', 1], ['White', 2]]);
});

test('a tie is headed by shape', () => {
  assert.equal(lineGroupBy([line(1, 'Round', 7, 'White'), line(2, 'Oval', 8, 'Blue')]), 'shape');
});
