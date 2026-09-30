import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedColorsOf, facetAvailability, pickedSizeRows, sizeGroupsOf } from '../lib/faceted-picker';
import { referencePhotos } from '../lib/order-reference-photos';

// Round 6, 8 · Heart 6x6 · Cushion 6x6, 8x8
const ROUND = 1, HEART = 2, CUSHION = 3;
const rows = [
  { id: 11, shapeId: ROUND, sizeMm: '6' },
  { id: 12, shapeId: ROUND, sizeMm: '8' },
  { id: 21, shapeId: HEART, sizeMm: '6x6' },
  { id: 31, shapeId: CUSHION, sizeMm: '6 x 6 mm' },
  { id: 32, shapeId: CUSHION, sizeMm: '8x8' }
];
const groups = sizeGroupsOf(rows);
const shapes = [ROUND, HEART, CUSHION];
const idx = (label: string) => groups.findIndex((g) => g.key === label);
const none = { shapeIds: [] as number[], sizeIdxs: [] as number[], colorIds: [] as number[] };

test('nothing picked offers everything; sizes are merged by millimetre and sorted', () => {
  assert.deepEqual(groups.map((g) => g.key), ['6', '6x6', '8', '8x8']);
  const a = facetAvailability(shapes, [7], groups, null, none);
  assert.equal(a.shapeIds.size, 3);
  assert.equal(a.sizeIdxs.size, 4);
});

test('a size picked first narrows the shapes to those cut in it', () => {
  const a = facetAvailability(shapes, [7], groups, null, { ...none, sizeIdxs: [idx('6x6')] });
  assert.deepEqual([...a.shapeIds].sort(), [HEART, CUSHION]);
  assert.deepEqual(pickedSizeRows(groups, [idx('6x6')], []).map((r) => r.id).sort(), [21, 31]);
});

test('a shape picked first narrows the sizes, and several shapes need a shared size', () => {
  const one = facetAvailability(shapes, [7], groups, null, { ...none, shapeIds: [CUSHION] });
  assert.deepEqual([...one.sizeIdxs].map((i) => groups[i].key).sort(), ['6x6', '8x8']);
  const two = facetAvailability(shapes, [7], groups, null, { ...none, shapeIds: [CUSHION, HEART] });
  assert.deepEqual([...two.sizeIdxs].map((i) => groups[i].key), ['6x6']);
});

test('a material picked first narrows shapes and sizes, and they narrow materials', () => {
  const TIGER = 100, AMETHYST = 101;
  // Tiger eye: Round 8 and Cushion 8x8. Amethyst: Round 6 only.
  const allowed = allowedColorsOf([[12, TIGER], [32, TIGER], [11, AMETHYST]]);
  const byMaterial = facetAvailability(shapes, [TIGER, AMETHYST], groups, allowed, { ...none, colorIds: [TIGER] });
  assert.deepEqual([...byMaterial.shapeIds].sort(), [ROUND, CUSHION]);
  assert.deepEqual([...byMaterial.sizeIdxs].map((i) => groups[i].key).sort(), ['8', '8x8']);
  const byShape = facetAvailability(shapes, [TIGER, AMETHYST], groups, allowed, { ...none, shapeIds: [CUSHION] });
  assert.deepEqual([...byShape.colorIds], [TIGER]);
  const bySize = facetAvailability(shapes, [TIGER, AMETHYST], groups, allowed, { ...none, sizeIdxs: [idx('6')] });
  assert.deepEqual([...bySize.colorIds], [AMETHYST]);
});

test('a size picked before any shape still brings its photos first', () => {
  const photos = [
    { id: 1, url: 'a', shapeIds: [ROUND], colorIds: [], sizeIds: [] },
    { id: 2, url: 'b', shapeIds: [HEART], colorIds: [7], sizeIds: [21] }
  ];
  const bySize = referencePhotos(photos, { shapeIds: [], colorIds: [], sizeIds: pickedSizeRows(groups, [idx('6x6')], []).map((r) => r.id) });
  assert.deepEqual(bySize.photos.map((p) => p.id), [2, 1]);
});
