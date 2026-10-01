import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSizes, suggestSizes } from '../lib/quick-order';

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
  assert.deepEqual(ok(1, '1.5, 1.1, 1.2-1.25, 1.1'), ['1.1', '1.2', '1.25', '1.5']);
  const miss = resolveSizes(sizes.filter((s) => s.shape_id === 1), '2.15');
  assert.ok('error' in miss && /nearest: 2.1, 2.2/.test(miss.error));
});

test('suggestions follow what is typed', () => {
  assert.deepEqual(suggestSizes(sizes.filter((s) => s.shape_id === 1), '1.7').map((s) => s.size_mm), ['1.7', '1.75']);
  assert.deepEqual(suggestSizes(sizes.filter((s) => s.shape_id === 1), '22').map((s) => s.size_mm), ['2.2', '2.25']);
});
