import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGSeriesGrid, parseGSeriesGroup, sizeKey } from '../lib/g-series-grid';

const groups = [{ id: 2, name: 'G-Series B' }, { id: 1, name: 'G-Series A · White D' }, { id: 9, name: 'Premium Colors' }];
const shapes = [{ id: 66, name: 'Oval' }, { id: 63, name: 'Octagon' }, { id: 1, name: 'Round' }, { id: 3, name: 'Square' }, { id: 4, name: 'Marquise' }];

function fixture(squarePrice = 23) {
  const sizes = [
    { id: 1, shapeId: 63, sizeMm: '3x5' }, { id: 2, shapeId: 66, sizeMm: '3x5' },
    { id: 3, shapeId: 63, sizeMm: '2x3' }, { id: 4, shapeId: 66, sizeMm: '2x3' },
    { id: 5, shapeId: 3, sizeMm: '4x4' }, { id: 6, shapeId: 1, sizeMm: '4.0' },
    { id: 7, shapeId: 3, sizeMm: '5x5' }, { id: 8, shapeId: 1, sizeMm: '5.0' },
    { id: 9, shapeId: 4, sizeMm: '5x10' }
  ];
  const p = (id: number, a: number, b: number) => [{ shapeSizeId: id, groupId: 1, price: a }, { shapeSizeId: id, groupId: 2, price: b }];
  const prices = [...p(1, 17, 19), ...p(2, 17, 19), ...p(3, 17, 18), ...p(4, 17, 18), ...p(5, 17, 19), ...p(6, 17, 19),
    ...p(7, squarePrice, 25), ...p(8, 23, 25)];
  return buildGSeriesGrid(groups, shapes, sizes, prices);
}

test('G-Series group names give a column letter and title', () => {
  assert.deepEqual(parseGSeriesGroup('G-Series A · White D'), { letter: 'A', title: 'White D' });
  assert.deepEqual(parseGSeriesGroup('G-Series E'), { letter: 'E', title: null });
  assert.equal(parseGSeriesGroup('Premium Colors'), null);
  assert.equal(sizeKey('4.0'), '4x4');
  assert.equal(sizeKey('10x14'), '10x14');
});

test('G-Series grid pairs shapes and sizes that cost the same, like the sheet', () => {
  const grid = fixture();
  assert.deepEqual(grid.columns.map((c) => c.letter), ['A', 'B']);
  assert.deepEqual(grid.families.map((f) => f.shapes.map((s) => s.name)), [['Octagon', 'Oval'], ['Square', 'Round']]);
  assert.deepEqual(grid.rows.map((r) => [r.sizes, r.prices]), [
    [[['2x3'], []], [17, 18]],
    [[['3x5'], ['4x4']], [17, 19]],
    [[[], ['5x5']], [23, 25]]
  ]);
});

test('a shape priced differently gets its own column instead of being misquoted', () => {
  const grid = fixture(24);
  assert.deepEqual(grid.families.map((f) => f.shapes.map((s) => s.name)), [['Octagon', 'Oval'], ['Square'], ['Round']]);
  assert.ok(grid.rows.some((r) => r.prices[0] === 24 && r.sizes[1].includes('5x5')));
});
