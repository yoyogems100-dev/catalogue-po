import test from 'node:test';
import assert from 'node:assert/strict';
import { anyLines, familyColor, shapesOf, sizeKeysOf, stonesForFamilies, stonesForPicks } from '../lib/quick-order-any';
import { findSize, normalize } from '../lib/voice-order';
import type { CatalogueMap } from '../lib/catalogue-map';

// White (family 1) in two stones, Red (family 4) in one.
const map: CatalogueMap = {
  materials: [],
  categories: [
    { id: 37, name: '5A Quality CZ', slug: 'cz-5a', colorIds: [10, 11], shapeIds: [1, 2], sizeIds: [100, 101, 200] },
    { id: 38, name: '7A Quality CZ', slug: 'cz-7a', colorIds: [10], shapeIds: [1], sizeIds: [100, 102] },
    { id: 2, name: 'Ruby Corundum', slug: 'ruby', colorIds: [20], shapeIds: [2], sizeIds: [201] }
  ],
  shapes: [{ id: 1, name: 'Round', iconKey: 'round', refPhotoUrl: '/white-round.jpg' }, { id: 2, name: 'Oval', iconKey: 'oval', refPhotoUrl: null }],
  sizes: [
    { id: 100, shapeId: 1, sizeMm: '3' }, { id: 101, shapeId: 1, sizeMm: '4' }, { id: 102, shapeId: 1, sizeMm: '5' },
    { id: 200, shapeId: 2, sizeMm: '4x6' }, { id: 201, shapeId: 2, sizeMm: '5x7' }
  ],
  colors: [
    { id: 11, name: 'Super White', hex: '#fff', refPhotoUrl: null, familyId: 1 },
    { id: 10, name: 'White', hex: '#fff', refPhotoUrl: null, familyId: 1 },
    { id: 20, name: 'Ruby Red', hex: '#c00', refPhotoUrl: null, familyId: 4 }
  ]
};

test('with no stone, shapes and sizes come from every stone in the colour', () => {
  assert.deepEqual(stonesForFamilies(map, [1]).map((c) => c.id), [37, 38]);
  assert.deepEqual(shapesOf(map, stonesForFamilies(map, [1])).map((s) => s.name), ['Round', 'Oval']);
  assert.deepEqual(sizeKeysOf(map, stonesForPicks(map, [1], [1]), [1]), ['3', '4', '5']);
  assert.deepEqual(sizeKeysOf(map, stonesForPicks(map, [4], [2]), [2]), ['5x7']);
  assert.deepEqual(stonesForPicks(map, [1, 4], [2]).map((c) => c.id), [37, 2]);
});

test('a family stands as its own-named colour, and lines skip sizes a shape lacks', () => {
  assert.equal(familyColor(map, 1, 'White')?.id, 10);
  assert.equal(familyColor(map, 4, 'Red')?.id, 20);
  const lines = anyLines(map, [{ id: 1, name: 'White' }, { id: 4, name: 'Red' }], [1, 2], ['3', '5x7']);
  assert.deepEqual(lines.map((l) => `${l.colorName} ${l.shapeName} ${l.sizeMm}`), ['White Round 3', 'Red Oval 5x7']);
  assert.equal(lines[0].shapeIconKey, 'round');
  assert.equal(lines[0].sizeId, 100);
});

test('voice hears a size either way round and in any spelling', () => {
  for (const t of ['3*4', '3 x 4', '3 by 4 mm', '3 into 4', '3 mm by 4 mm', '3 X 4']) assert.equal(normalize(t)[0], '3x4', t);
  const withPair: CatalogueMap = { ...map, sizes: [...map.sizes, { id: 300, shapeId: 2, sizeMm: '4x3' }],
    categories: map.categories.map((c) => (c.id === 37 ? { ...c, sizeIds: [...c.sizeIds, 300] } : c)) };
  const cz = withPair.categories.find((c) => c.id === 37)!;
  for (const heard of ['3x4', '4x3', '3*4']) assert.equal(findSize(withPair, cz, 2, heard), 300, heard);
});
