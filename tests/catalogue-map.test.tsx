import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByMaterial, matchCategories, sizesFor, type CatalogueMap } from '../lib/catalogue-map';

const map: CatalogueMap = {
  materials: [
    { id: 2, name: 'Glass', sortOrder: 2, categoryIds: [23] },
    { id: 1, name: 'Ruby', sortOrder: 1, categoryIds: [2, 26, 23] }
  ],
  categories: [
    { id: 2, name: 'Ruby Corundum', slug: 'ruby', colorIds: [4], shapeIds: [1, 2], sizeIds: [10, 11, 20] },
    { id: 26, name: 'Ruby Chatham', slug: null, colorIds: [5], shapeIds: [1], sizeIds: [12] },
    { id: 23, name: 'Ruby Glass Filled', slug: null, colorIds: [4], shapeIds: [2], sizeIds: [20] },
    { id: 37, name: '5A Quality CZ', slug: null, colorIds: [1], shapeIds: [1], sizeIds: [10] }
  ],
  shapes: [{ id: 1, name: 'Round', refPhotoUrl: null }, { id: 2, name: 'Oval', refPhotoUrl: null }],
  sizes: [
    { id: 10, shapeId: 1, sizeMm: '3' }, { id: 11, shapeId: 1, sizeMm: '1.5' }, { id: 12, shapeId: 1, sizeMm: '3.0 mm' },
    { id: 20, shapeId: 2, sizeMm: '6*8' }
  ],
  colors: [
    { id: 1, name: 'White', hex: null, refPhotoUrl: null, familyId: 1 },
    { id: 4, name: 'Ruby Red', hex: null, refPhotoUrl: null, familyId: 4 },
    { id: 5, name: 'Pigeon Blood', hex: null, refPhotoUrl: null, familyId: 4 }
  ]
};

test('colour family + shape + size finds every stone that carries all three', () => {
  const ids = (q: any) => matchCategories(map, q).map((c) => c.id);
  assert.deepEqual(ids({ familyId: 4 }), [2, 26, 23]); // any red
  assert.deepEqual(ids({ colorId: 4 }), [2, 23]); // exact colour
  assert.deepEqual(ids({ familyId: 4, shapeId: 1, size: '3' }), [2, 26]); // "3" and "3.0 mm" are the same size
  assert.deepEqual(ids({ familyId: 4, shapeId: 2, size: '6x8' }), [2, 23]); // 6*8 written either way
  assert.deepEqual(ids({ familyId: 1, shapeId: 2 }), []);
});

test('results group under materials in the owner order; a stone under two materials shows in both; the rest go last', () => {
  const groups = groupByMaterial(map, map.categories);
  assert.deepEqual(groups.map((g) => [g.material?.name ?? null, g.categories.map((c) => c.id)]), [
    ['Ruby', [2, 26, 23]],
    ['Glass', [23]],
    [null, [37]]
  ]);
});

test('size list for a shape is distinct and smallest first', () => {
  assert.deepEqual(sizesFor(map, map.categories, 1).map((s) => s.key), ['1.5', '3']);
});
