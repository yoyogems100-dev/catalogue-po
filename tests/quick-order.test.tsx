import test from 'node:test';
import assert from 'node:assert/strict';
import { matchShape, parseOrderText, resolveSizes, suggestSizes } from '../lib/quick-order';

const shapes = [
  { id: 1, name: 'Round' }, { id: 68, name: 'Pear' }, { id: 4, name: 'Marquise' },
  { id: 32, name: 'Baguette' }, { id: 82, name: 'Tapered Baguette' }
];
let n = 0;
const rows = (shapeId: number, list: string, rate?: (mm: number) => number | null) =>
  list.split(' ').map((size_mm) => ({ id: ++n, shape_id: shapeId, size_mm, pcs_per_ct: rate ? rate(Number(size_mm)) : null }));
const sizes = [
  ...rows(1, '0.7 1 1.1 1.2 1.25 1.3 1.4 1.5 1.6 1.7 1.75 1.8 1.9 2 2.1 2.2 2.25 2.3 2.4 2.5 2.9 3 20 30', (mm) => (mm < 3 ? 10 : null)),
  ...rows(68, '2.5x4 7x9'),
  ...rows(4, '2x4'),
  ...rows(32, '1x2 1.5x2 1.5x3 2x4'),
  ...rows(82, '2x1.5x1 3x2x1 3x2x1.5 4x2x1.5')
];
const mm = (id: number) => sizes.find((s) => s.id === id)!.size_mm;
const ok = (shape: number, text: string) => {
  const r = resolveSizes(sizes.filter((s) => s.shape_id === shape), text);
  assert.ok('sizes' in r, text);
  return (r as { sizes: { size_mm: string }[] }).sizes.map((s) => s.size_mm);
};

test('sizes are read as buyers write them', () => {
  assert.deepEqual(ok(1, '110'), ['1.1']);
  assert.deepEqual(ok(1, '2.00'), ['2']);
  assert.deepEqual(ok(1, '20'), ['20']);
  assert.deepEqual(ok(1, '19'), ['1.9']); // no 19 mm Round
  assert.deepEqual(ok(1, '225'), ['2.25']);
  assert.deepEqual(ok(1, '1.25 mm'), ['1.25']);
  assert.deepEqual(ok(82, '1x1.5x2'), ['2x1.5x1']);
  assert.deepEqual(ok(1, '1.2-1.4'), ['1.2', '1.25', '1.3', '1.4']);
  assert.deepEqual(ok(1, '140 to 120'), ['1.2', '1.25', '1.3', '1.4']);
  const miss = resolveSizes(sizes.filter((s) => s.shape_id === 1), '2.15');
  assert.ok('error' in miss && /nearest: 2.1, 2.2/.test(miss.error));
});

test('suggestions follow what is typed', () => {
  assert.deepEqual(suggestSizes(sizes.filter((s) => s.shape_id === 1), '1.7').map((s) => s.size_mm), ['1.7', '1.75']);
  assert.deepEqual(suggestSizes(sizes.filter((s) => s.shape_id === 1), '22').map((s) => s.size_mm), ['2.2', '2.25']);
});

test('shape names as spelt in a notebook', () => {
  assert.equal(matchShape(shapes, 'MARQUISS')?.name, 'Marquise');
  assert.equal(matchShape(shapes, 'Bagutte')?.name, 'Baguette');
  assert.equal(matchShape(shapes, 'tapered')?.name, 'Tapered Baguette');
  assert.equal(matchShape(shapes, 'xyz'), null);
});

test('the sample notebook order reads in one go', () => {
  const text = `Round
1.00 -> 30ct
110 -> 70 ct
1.2-1.8 100 ct
190 - 50 ct
2.00 - 50ct
230 — 50 ct, 240 50ct, 2.5 50
Pear
2.5x4 — 300
MARQUISS: 2x4 300
BAGUTTE
1x2 - 50
1x1.5x2 - 50 ct
1.5x2 50 pcs`;
  const r = parseOrderText(text, shapes, sizes, null);
  const got = r.lines.map((l) => `${shapes.find((s) => s.id === l.shapeId)!.name} ${mm(l.sizeId)} ${l.amount}`);
  assert.deepEqual(got, [
    'Round 1 30', 'Round 1.1 70',
    'Round 1.2 100', 'Round 1.25 100', 'Round 1.3 100', 'Round 1.4 100', 'Round 1.5 100', 'Round 1.6 100', 'Round 1.7 100', 'Round 1.75 100', 'Round 1.8 100',
    'Round 1.9 50', 'Round 2 50', 'Round 2.3 50', 'Round 2.4 50', 'Round 2.5 50',
    'Pear 2.5x4 300', 'Marquise 2x4 300', 'Baguette 1x2 50', 'Baguette 1.5x2 50'
  ]);
  // Sizes above 3 mm and other shapes are ordered in pieces: "ct" there is flagged, not guessed.
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /2x1.5x1 mm is ordered in pcs/);
  // Only what was not added goes back in the box, under its shape heading.
  assert.deepEqual(r.rejected, ['Baguette', '1x1.5x2 - 50 ct']);
});

test('lines before a shape heading use the shape on screen', () => {
  assert.deepEqual(parseOrderText('1.1 70', shapes, sizes, 1).lines.map((l) => mm(l.sizeId)), ['1.1']);
  assert.match(parseOrderText('1.1 70', shapes, sizes, null).problems[0], /which shape/);
  assert.match(parseOrderText('Round 3 5 ct', shapes, sizes, null).problems[0], /ordered in pcs/);
});
